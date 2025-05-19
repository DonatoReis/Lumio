/**
 * Script de Testes Automatizados para Verificar Correções
 * 
 * Este script testa as correções implementadas:
 * 1. Validação e normalização de emails
 * 2. Consultas com email exato vs. parcial
 * 3. Criação de conversas (permissões RLS)
 * 
 * Uso: ts-node scripts/test_fixes.ts
 */

// Usar versão CommonJS para compatibilidade
const path = require('path');
const chalk = require('chalk');

// Importar com require
let supabase;
let emailValidator;

try {
  // Tentar importar de forma relativa
  supabase = require('../src/integrations/supabase/client').supabase;
  emailValidator = require('../src/utils/email-validator');
} catch (e) {
  console.error('Erro ao importar módulos necessários:', e);
  console.log('Tentando alternativa de importação...');
  
  try {
    // Alternativa com caminhos absolutos
    const rootDir = path.resolve(__dirname, '..');
    supabase = require(path.join(rootDir, 'src/integrations/supabase/client')).supabase;
    emailValidator = require(path.join(rootDir, 'src/utils/email-validator'));
  } catch (e2) {
    console.error('Falha ao importar módulos. Não é possível executar os testes:', e2);
    process.exit(1);
  }
}

const { normalizeEmail, isValidEmail, areEmailsEquivalent } = emailValidator;

// Utilitário para logs formatados
const log = {
  info: (msg) => console.log(chalk.blue(`[INFO] ${msg}`)),
  success: (msg) => console.log(chalk.green(`[SUCCESS] ${msg}`)),
  warn: (msg) => console.log(chalk.yellow(`[WARN] ${msg}`)),
  error: (msg) => console.log(chalk.red(`[ERROR] ${msg}`)),
  result: (title, result) => console.log(
    chalk.cyan(`[RESULT] ${title}: `), 
    typeof result === 'object' ? JSON.stringify(result, null, 2) : result
  )
};

/**
 * Testa a funcionalidade de normalização de email
 */
async function testEmailNormalization() {
  log.info('Testando normalização de email...');
  
  const testCases = [
    { input: 'user@domain.com', expected: 'user@domain.com' },
    { input: 'USER@Domain.COM', expected: 'user@domain.com' },
    { input: 'user@domain.co', expected: 'user@domain.com' },
    { input: 'user@domain.comm', expected: 'user@domain.com' },
    { input: 'user@domain.con', expected: 'user@domain.com' },
    { input: 'user@domain.c0m', expected: 'user@domain.com' },
    { input: 'user@domain.ne', expected: 'user@domain.net' },
    { input: 'user@domain.or', expected: 'user@domain.org' },
    { input: '  user@domain.com  ', expected: 'user@domain.com' }
  ];
  
  const results = testCases.map(test => {
    const normalized = normalizeEmail(test.input);
    const passed = normalized === test.expected;
    
    return {
      input: test.input,
      expected: test.expected,
      actual: normalized,
      passed
    };
  });
  
  const passedCount = results.filter(r => r.passed).length;
  log.result('Resultados', results);
  
  if (passedCount === testCases.length) {
    log.success(`Todos os ${passedCount} testes de normalização passaram!`);
  } else {
    log.error(`${passedCount}/${testCases.length} testes de normalização passaram`);
  }
  
  // Teste de equivalência
  const equivalenceTests = [
    { email1: 'user@domain.com', email2: 'USER@DOMAIN.COM', expected: true },
    { email1: 'user@domain.com', email2: 'user@domain.co', expected: true },
    { email1: 'user@domain.com', email2: 'user2@domain.com', expected: false },
    { email1: 'user@domain.com', email2: 'user@otherdomain.com', expected: false }
  ];
  
  const equivalenceResults = equivalenceTests.map(test => {
    const result = areEmailsEquivalent(test.email1, test.email2);
    return {
      email1: test.email1,
      email2: test.email2,
      expected: test.expected,
      actual: result,
      passed: result === test.expected
    };
  });
  
  const equivalencePassedCount = equivalenceResults.filter(r => r.passed).length;
  log.result('Resultados de Equivalência', equivalenceResults);
  
  if (equivalencePassedCount === equivalenceTests.length) {
    log.success(`Todos os ${equivalencePassedCount} testes de equivalência passaram!`);
  } else {
    log.error(`${equivalencePassedCount}/${equivalenceTests.length} testes de equivalência passaram`);
  }
}

/**
 * Testa a busca de usuário por email
 */
async function testFindUserByEmail() {
  log.info('Testando busca de usuário por email...');
  
  if (!supabase) {
    log.error('Cliente Supabase não inicializado');
    return;
  }
  
  // Primeiro vamos verificar se há uma sessão ativa
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    log.error('Sem sessão autenticada. Faça login antes de rodar este teste.');
    return;
  }
  
  log.info(`Usuário autenticado como: ${session.user.email}`);
  
  // Buscar alguns usuários do sistema para teste
  const { data: testUsers, error: usersError } = await supabase
    .from('profiles')
    .select('id, email')
    .limit(5);
  
  if (usersError || !testUsers || testUsers.length === 0) {
    log.error('Não foi possível obter usuários de teste:', usersError?.message || 'Nenhum usuário encontrado');
    return;
  }
  
  log.info(`Encontrados ${testUsers.length} usuários para teste`);
  
  // Testar busca por email para cada usuário
  for (const user of testUsers) {
    log.info(`Testando busca para usuário: ${user.email}`);
    
    // Teste 1: Email exato
    const { data: exactMatch, error: exactError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', user.email)
      .limit(1);
    
    if (exactError) {
      log.error(`Erro na busca exata: ${exactError.message}`);
    } else if (!exactMatch || exactMatch.length === 0) {
      log.error(`Não foi encontrado usuário com email exato: ${user.email}`);
    } else {
      log.success(`Usuário encontrado com email exato: ${exactMatch[0].email}`);
    }
    
    // Teste 2: Email com variação de caso
    const uppercaseEmail = user.email.toUpperCase();
    const { data: caseMatch, error: caseError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('email', uppercaseEmail)
      .limit(1);
    
    if (caseError) {
      log.error(`Erro na busca com variação de caso: ${caseError.message}`);
    } else if (!caseMatch || caseMatch.length === 0) {
      log.warn(`Não foi encontrado usuário com email case-insensitive: ${uppercaseEmail}`);
      log.info(`Isso é esperado se a busca for case-sensitive. Tente usar ilike ou normalizar o email antes.`);
    } else {
      log.success(`Usuário encontrado com email case-insensitive: ${caseMatch[0].email}`);
    }
    
    // Teste 3: Modificar domínio (.co em vez de .com)
    const emailParts = user.email.split('@');
    if (emailParts.length === 2 && emailParts[1].includes('.com')) {
      const modifiedEmail = `${emailParts[0]}@${emailParts[1].replace('.com', '.co')}`;
      
      // Este teste deve falhar se usarmos eq, mas poderia passar se usássemos nossa função de normalização
      const { data: modifiedMatch, error: modifiedError } = await supabase
        .from('profiles')
        .select('id, email')
        .eq('email', modifiedEmail)
        .limit(1);
      
      if (modifiedError) {
        log.error(`Erro na busca com domínio modificado: ${modifiedError.message}`);
      } else if (!modifiedMatch || modifiedMatch.length === 0) {
        log.info(`Não foi encontrado usuário com domínio modificado: ${modifiedEmail}`);
        log.info(`Isso é esperado com consulta exata. Nossa função normalizeEmail deveria corrigir isso.`);
        
        // Testar normalização
        const normalizedEmail = normalizeEmail(modifiedEmail);
        log.info(`Email normalizado: ${normalizedEmail}`);
        
        if (normalizedEmail === user.email.toLowerCase()) {
          log.success(`Normalização correta: ${modifiedEmail} -> ${normalizedEmail}`);
        } else {
          log.warn(`Normalização não restaurou o email original: ${modifiedEmail} -> ${normalizedEmail} != ${user.email.toLowerCase()}`);
        }
      } else {
        log.warn(`Usuário encontrado com domínio modificado: ${modifiedMatch[0].email}`);
        log.warn(`Isso indica que a consulta não é exata e pode causar problemas de falsos positivos.`);
      }
    }
  }
}

/**
 * Testa a criação de conversa (deve ter políticas RLS corretas)
 */
async function testConversationCreation() {
  log.info('Testando criação de conversa...');
  
  if (!supabase) {
    log.error('Cliente Supabase não inicializado');
    return;
  }
  
  // Verificar se há uma sessão ativa
  const { data: { session }, error: sessionError } = await supabase.auth.getSession();
  
  if (sessionError || !session) {
    log.error('Sem sessão autenticada. Faça login antes de rodar este teste.');
    return;
  }
  
  // Buscar outro usuário para testar a conversa
  const { data: otherUsers, error: usersError } = await supabase
    .from('profiles')
    .select('id, email')
    .neq('id', session.user.id)
    .limit(1);
  
  if (usersError || !otherUsers || otherUsers.length === 0) {
    log.error('Não foi possível encontrar outro usuário para teste:', usersError?.message || 'Nenhum usuário encontrado');
    return;
  }
  
  const otherUser = otherUsers[0];
  log.info(`Usuário encontrado para teste: ${otherUser.email}`);
  
  // Tentar criar uma conversa
  try {
    log.info('Tentando criar uma conversa...');
    
    // 1. Criar a conversa
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .insert({ name: `Test Conversation ${new Date().toISOString()}` })
      .select()
      .single();
    
    if (convError) {
      log.error(`Erro ao criar conversa: ${convError.message}`);
      log.error(`Código: ${convError.code}`);
      log.error(`Detalhes: ${convError.details}`);
      log.error('Este erro indica problema com a política RLS para INSERT em conversations');
      
      if (convError.code === '42501') {
        log.info('Sugestão: Execute o script fix_rls_policies.sql para corrigir as políticas RLS');
      }
      
      return;
    }
    
    log.success(`Conversa criada com sucesso: ${conversation.id}`);
    
    // 2. Adicionar o usuário atual como participante
    const { error: currentUserError } = await supabase
      .from('conversation_participants')
      .insert({
        conversation_id: conversation.id,
        user_id: session.user.id
      });
    
    if (currentUserError) {
      log.error(`Erro ao adicionar usuário atual como participante: ${currentUserError.message}`);
      log.error(`Código: ${currentUserError.code}`);
      log.error(`Detalhes: ${currentUserError.details}`);
      log.error('Este erro indica problema com a política RLS para INSERT em conversation_participants');
      return;
    }
    
    log.success(`Usuário atual adicionado como participante`);
    
    // 3. Adicionar o outro usuário como participante
    const { error: otherUserError } = await supabase
      .from('conversation_participants')
      .insert({
        conversation_id: conversation.id,
        user_id: otherUser.id
      });
    
    if (otherUserError) {
      log.error(`Erro ao adicionar outro usuário como participante: ${otherUserError.message}`);
      log.error(`Código: ${otherUserError.code}`);
      log.error(`Detalhes: ${otherUserError.details}`);
      return;
    }
    
    log.success(`Outro usuário adicionado como participante`);
    
    // 4. Verificar se podemos recuperar a conversa
    const { data: retrievedConv, error: retrieveError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', conversation.id)
      .single();
    
    if (retrieveError) {
      log.error(`Erro ao recuperar a conversa: ${retrieveError.message}`);
      return;
    }
    
    log.success(`Conversa recuperada com sucesso: ${retrievedConv.id}`);
    
    // 5. Verificar se podemos recuperar os participantes
    const { data: participants, error: partError } = await supabase
      .from('conversation_participants')
      .select('user_id')
      .eq('conversation_id', conversation.id);
    
    if (partError) {
      log.error(`Erro ao recuperar participantes: ${partError.message}`);
      return;
    }
    
    log.success(`Participantes recuperados com sucesso: ${participants.length}`);
    
    // Tudo funcionou!
    log.success('TESTE COMPLETO: Criação de conversa e adição de participantes funcionou corretamente!');
    log.success('As políticas RLS parecem estar configuradas corretamente.');
    
  } catch (error) {
    log.error(`Exceção não tratada: ${error.message}`);
  }
}

// Função principal para executar os testes
async function runTests() {
  console.log(chalk.bold.cyan('\n=== INICIANDO TESTES DE CORREÇÕES ===\n'));
  
  // 1. Testar normalização de email
  await testEmailNormalization();
  console.log('\n');
  
  // 2. Testar busca de usuário por email
  await testFindUserByEmail();
  console.log('\n');
  
  // 3. Testar criação de conversa
  await testConversationCreation();
  console.log('\n');
  
  console.log(chalk.bold.cyan('=== TESTES CONCLUÍDOS ===\n'));
}

// Executar os testes
runTests().catch(error => {
  console.error(chalk.red('Erro ao executar testes:'), error);
  process.exit(1);
});
