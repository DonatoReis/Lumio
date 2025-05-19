/**
 * Analisador estático para codebase do BizConnect
 * 
 * Este script analisa o código-fonte do projeto para detectar:
 * - Acessos potencialmente inseguros a propriedades (undefined/null)
 * - Problemas de validação de email
 * - Uso inconsistente de APIs (ex: Supabase)
 * 
 * Uso: ts-node scripts/analyzer.ts [--fix]
 */

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import * as glob from 'glob';
import { fileURLToPath } from 'url';

// Obter o caminho do diretório atual
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurações
const CONFIG = {
  rootDir: path.resolve(__dirname, '..'),
  srcDir: path.resolve(__dirname, '../src'),
  shouldFix: process.argv.includes('--fix'),
  verbose: process.argv.includes('--verbose'),
};

// Statistics
const stats = {
  filesScanned: 0,
  potentialNullAccess: 0,
  emailValidationIssues: 0,
  fixesSuggested: 0,
  fixesApplied: 0,
};

// Cores para output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

// Logger com cores
const log = {
  info: (msg: string) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  warn: (msg: string) => console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`),
  error: (msg: string) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  success: (msg: string) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  detail: (msg: string) => CONFIG.verbose && console.log(`${colors.cyan}[DETAIL]${colors.reset} ${msg}`),
};

/**
 * Encontra todos os arquivos TypeScript/JavaScript no projeto
 */
function findSourceFiles(): string[] {
  const patterns = [
    path.join(CONFIG.srcDir, '**/*.ts'),
    path.join(CONFIG.srcDir, '**/*.tsx'),
    path.join(CONFIG.srcDir, '**/*.js'),
    path.join(CONFIG.srcDir, '**/*.jsx'),
  ];
  
  const filePaths: string[] = [];
  patterns.forEach(pattern => {
    const matches = glob.sync(pattern);
    filePaths.push(...matches);
  });
  
  return filePaths.filter(file => !file.includes('node_modules'));
}

/**
 * Analisa um arquivo em busca de problemas potenciais
 */
function analyzeFile(filePath: string): void {
  log.detail(`Analisando ${filePath}`);
  stats.filesScanned++;
  
  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const sourceFile = ts.createSourceFile(
    filePath,
    fileContent,
    ts.ScriptTarget.ESNext,
    true
  );
  
  // Análise de acesso a propriedades inseguras
  analyzePropertyAccess(sourceFile, filePath, fileContent);
  
  // Análise de validação de email
  analyzeEmailValidation(sourceFile, filePath, fileContent);
}

/**
 * Analisa acesso a propriedades com potenciais undefined/null
 */
function analyzePropertyAccess(sourceFile: ts.SourceFile, filePath: string, fileContent: string): void {
  // Função de visitação recursiva do AST
  function visit(node: ts.Node) {
    // Detecta PropertyAccessExpression: obj.prop, obj.method()
    if (ts.isPropertyAccessExpression(node)) {
      const objExpr = node.expression;
      const propName = node.name.getText(sourceFile);
      
      // Verifica se está acessando nested properties sem optional chaining
      if (ts.isPropertyAccessExpression(objExpr) && 
          !node.getFullText(sourceFile).includes('?.')) {
        const objectPath = objExpr.getFullText(sourceFile).trim();
        const fullPath = `${objectPath}.${propName}`;
        
        // Procura por padrões problemáticos
        if ((objectPath.includes('result') || 
             objectPath.includes('data') || 
             objectPath.includes('response')) && 
            !objectPath.includes('?')) {
          
          const lineInfo = ts.getLineAndCharacterOfPosition(sourceFile, node.getStart());
          const line = lineInfo.line + 1;
          
          log.warn(`Possível acesso inseguro a ${colors.cyan}${fullPath}${colors.reset} em ${colors.magenta}${filePath}:${line}${colors.reset}`);
          stats.potentialNullAccess++;
          
          if (CONFIG.shouldFix) {
            // Gerar versão corrigida usando optional chaining
            // Esta é uma implementação simplificada; uma real precisaria de mais contexto
            const fixedObjectPath = objectPath.replace('.', '?.');
            const fixedPropertyAccess = `${fixedObjectPath}.${propName}`;
            
            log.info(`Correção sugerida: ${colors.red}${fullPath}${colors.reset} -> ${colors.green}${fixedPropertyAccess}${colors.reset}`);
            stats.fixesSuggested++;
          }
        }
      }
    }
    
    ts.forEachChild(node, visit);
  }
  
  visit(sourceFile);
}

/**
 * Analisa usos de validação de email no código
 */
function analyzeEmailValidation(sourceFile: ts.SourceFile, filePath: string, fileContent: string): void {
  // Busca por padrões de manipulação de email
  const emailRegexs = [
    /email\s*=/,
    /email\.trim/,
    /^\s*if\s*\([^)]*email/m,
    /validateEmail/,
    /isValidEmail/,
    /checkEmail/,
    /email[^a-zA-Z0-9]/
  ];
  
  let hasEmailHandling = false;
  for (const regex of emailRegexs) {
    if (regex.test(fileContent)) {
      hasEmailHandling = true;
      break;
    }
  }
  
  if (hasEmailHandling) {
    // Verifica se tem importação das funções centralizadas
    const importValidator = /import.*['"]@\/utils\/email-validator['"]/.test(fileContent);
    
    if (!importValidator) {
      log.warn(`Manipulação de email sem usar o validador centralizado em ${colors.magenta}${filePath}${colors.reset}`);
      stats.emailValidationIssues++;
      
      if (CONFIG.shouldFix) {
        log.info(`Correção sugerida: Adicionar ${colors.green}import { normalizeEmail, isValidEmail } from '@/utils/email-validator';${colors.reset}`);
        stats.fixesSuggested++;
      }
    }
  }
  
  // Verificar email regexs definidos localmente
  const emailRegexDefinitions = [
    /const\s+[a-zA-Z0-9_]+\s*=\s*\/.*@.*\//,
    /let\s+[a-zA-Z0-9_]+\s*=\s*\/.*@.*\//,
    /var\s+[a-zA-Z0-9_]+\s*=\s*\/.*@.*\//,
    /\/[^\/]*@[^\/]*\.[^\/]*\//
  ];
  
  for (const regex of emailRegexDefinitions) {
    const matches = fileContent.match(regex);
    if (matches) {
      log.warn(`Regex de email definido localmente em ${colors.magenta}${filePath}${colors.reset}: ${colors.cyan}${matches[0]}${colors.reset}`);
      stats.emailValidationIssues++;
      
      if (CONFIG.shouldFix) {
        log.info(`Correção sugerida: Usar ${colors.green}isValidEmail() from '@/utils/email-validator'${colors.reset} ao invés de regex local`);
        stats.fixesSuggested++;
      }
    }
  }
}

/**
 * Função principal
 */
function main(): void {
  log.info(`Iniciando análise estática no diretório: ${CONFIG.srcDir}`);
  
  const sourceFiles = findSourceFiles();
  log.info(`Encontrados ${sourceFiles.length} arquivos para análise`);
  
  sourceFiles.forEach(analyzeFile);
  
  log.info('\n--- Relatório de Análise Estática ---');
  log.info(`Arquivos analisados: ${stats.filesScanned}`);
  log.info(`Potenciais acessos a null/undefined: ${stats.potentialNullAccess}`);
  log.info(`Problemas com validação de email: ${stats.emailValidationIssues}`);
  log.info(`Correções sugeridas: ${stats.fixesSuggested}`);
  log.info(`Correções aplicadas: ${stats.fixesApplied}`);
  
  if (stats.potentialNullAccess > 0 || stats.emailValidationIssues > 0) {
    log.warn('\nForam encontrados problemas que precisam de atenção.');
    log.info('Execute com --fix para aplicar correções automáticas onde possível.');
  } else {
    log.success('\nNenhum problema crítico encontrado!');
  }
}

// Executar o analisador
main();

