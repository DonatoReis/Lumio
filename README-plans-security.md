## Considerações de Segurança

### Row-Level Security (RLS)

Todas as tabelas têm Row-Level Security (RLS) configurado:

- `plans`, `features`, `plan_features`: Visíveis para todos, mas modificáveis apenas por admins
- `user_plans`, `user_features`: Visíveis e modificáveis apenas pelo próprio usuário
- `stripe_events`: Acessível apenas pelo service role (não via cliente)

Importante: A tabela `user_features` tem políticas específicas para evitar que usuários adicionem features manualmente:

```sql
CREATE POLICY "Insert de features só pelo sistema" ON user_features
  FOR INSERT TO authenticated
  USING (false)
  WITH CHECK (false);
```

### Proteção de Webhooks

Webhooks do Stripe são protegidos por:

1. **Verificação de assinatura**: Usando a secret compartilhada com o Stripe
2. **Idempotência**: Cada evento é processado apenas uma vez (tabela `stripe_events`)
3. **Retry automático**: Exponential backoff para falhas temporárias

### Segurança no Frontend

1. **Validação no servidor**: Todas as permissões são verificadas no banco de dados, nunca confiando apenas no cliente
2. **Proteção contra XSS**: Dados sensíveis nunca são expostos no frontend
3. **Desacoplamento**: Componente `FeatureGate` centraliza a lógica de acesso

### Isolamento de Secrets

Todas as chaves secretas são armazenadas como variáveis de ambiente no Supabase:

- `STRIPE_SECRET_KEY`: Chave secreta do Stripe para operações de API
- `STRIPE_WEBHOOK_SECRET`: Secret para validar webhooks
- `SUPABASE_SERVICE_ROLE_KEY`: Utilizada apenas nas Edge Functions

## Conclusão

Este sistema de gerenciamento de planos foi projetado para ser:

- **Seguro**: Com RLS, validação de assinaturas e verificações de autenticação
- **Desacoplado**: Sem lógica de planos embutida no código
- **Escalável**: Facilmente extensível para novos planos e features
- **Resiliente**: Com retries, idempotência e tratamento de erros
- **Manutenível**: Fácil de adicionar/remover planos e features sem deployment

Para qualquer dúvida ou problema, consulte as seções de troubleshooting ou entre em contato com a equipe de desenvolvimento.


Tudo pronto! O sistema de gerenciamento de planos de usuários foi implementado com sucesso.
