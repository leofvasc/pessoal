-- Revogação de sessões JWT ao trocar a senha.
--
-- Adiciona o campo `senhaAlteradaEm` ao modelo Usuario. Quando o titular
-- altera a senha, o campo é preenchido com o instante da troca. A validação
-- do JWT passa a rejeitar tokens emitidos antes desse instante, o que
-- invalida sessões abertas em outros dispositivos sem exigir uma lista negra
-- centralizada nem rotação manual do segredo JWT.
--
-- O campo é nullable: contas existentes ficam com NULL, o que significa "sem
-- troca registrada" — e, portanto, qualquer token ainda válido pela assinatura
-- continua aceito até que a senha seja trocada pela primeira vez.

ALTER TABLE "Usuario" ADD COLUMN "senhaAlteradaEm" TIMESTAMP(3);
