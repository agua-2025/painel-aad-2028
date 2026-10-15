-- AAD DIREITO 2028
-- Função de registro de desligamento de associado
-- DESENVOLVIMENTO: NÃO EXECUTAR EM PRODUÇÃO SEM VALIDAÇÃO.

BEGIN;

CREATE OR REPLACE FUNCTION public.registrar_desligamento_associado(
    p_associate_id uuid,
    p_motivo text,
    p_data date,
    p_documento text,
    p_observacoes text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_associado public.associates%ROWTYPE;
    v_profile_id uuid;
BEGIN
    -- 1. Exigir usuário autenticado e autorizado.

    IF auth.uid() IS NULL
       OR NOT COALESCE(public.can_manage_associates(), false)
    THEN
        RAISE EXCEPTION
            'Usuário sem autorização para registrar desligamentos.';
    END IF;

    -- 2. Validar dados obrigatórios.

    IF p_associate_id IS NULL
       OR p_data IS NULL
       OR NULLIF(BTRIM(p_documento), '') IS NULL
       OR NULLIF(BTRIM(COALESCE(p_observacoes, '')), '') IS NULL
    THEN
        RAISE EXCEPTION
            'Informe associado, data, documento e justificativa.';
    END IF;

    IF p_data > CURRENT_DATE THEN
        RAISE EXCEPTION
            'A data do desligamento não pode ser futura.';
    END IF;

    IF p_motivo IS NULL OR p_motivo NOT IN (
        'voluntario',
        'exclusao_inadimplencia',
        'exclusao_outras_causas'
    ) THEN
        RAISE EXCEPTION
            'Motivo de desligamento inválido.';
    END IF;

    -- 3. Identificar o usuário responsável pelo registro.

    SELECT id
    INTO v_profile_id
    FROM public.profiles
    WHERE user_id = auth.uid();

    IF v_profile_id IS NULL THEN
        RAISE EXCEPTION
            'Perfil do usuário responsável não localizado.';
    END IF;

    -- 4. Consultar e bloquear o cadastro durante a operação.

    SELECT *
    INTO v_associado
    FROM public.associates
    WHERE id = p_associate_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION
            'Associado não localizado.';
    END IF;

    IF v_associado.status <> 'ativo' THEN
        RAISE EXCEPTION
            'O associado não está ativo. Situação atual: %.',
            v_associado.status;
    END IF;

    -- Impedir desligamento anterior ao ingresso registrado.
    IF v_associado.joined_at IS NOT NULL
       AND p_data < v_associado.joined_at THEN
        RAISE EXCEPTION
            'A data do desligamento não pode ser anterior ao ingresso.';
    END IF;

    -- 5. Atualizar o cadastro.

    UPDATE public.associates
    SET
        status = 'desligado',
        left_at = p_data,
        financial_status = CASE
            WHEN p_motivo = 'exclusao_inadimplencia'
            THEN 'desligado_por_inadimplencia'
                 ::public.associate_financial_status
            ELSE v_associado.financial_status
        END
    WHERE id = p_associate_id;

    -- 6. Registrar o histórico.

    INSERT INTO public.associate_status_history (
        associate_id,
        previous_status,
        new_status,
        reason,
        decision_date,
        decided_by,
        document_reference,
        notes
    )
    VALUES (
        p_associate_id,
        v_associado.status,
        'desligado',
        CASE p_motivo
            WHEN 'voluntario'
                THEN 'Desligamento voluntário'
            WHEN 'exclusao_inadimplencia'
                THEN 'Exclusão por inadimplência'
            WHEN 'exclusao_outras_causas'
                THEN 'Exclusão por outras causas estatutárias'
        END,
        p_data,
        v_profile_id,
        BTRIM(p_documento),
        BTRIM(p_observacoes)
    );

    RETURN p_associate_id;
END;
$$;

-- Autorizar somente sessões autenticadas a chamar a função.
-- A autorização efetiva será verificada dentro da função.

REVOKE ALL ON FUNCTION
public.registrar_desligamento_associado(
    uuid, text, date, text, text
) FROM PUBLIC;

REVOKE ALL ON FUNCTION
public.registrar_desligamento_associado(
    uuid, text, date, text, text
) FROM anon;

GRANT EXECUTE ON FUNCTION
public.registrar_desligamento_associado(
    uuid, text, date, text, text
) TO authenticated;

COMMIT;
