-- AAD DIREITO 2028
-- Registro de definicoes recuperadas do banco de producao em 15/10/2026.
-- Arquivo de referencia para versionamento. NAO executar novamente sem revisao.
-- As definicoes abaixo vieram de pg_get_functiondef. O vinculo do gatilho
-- e os GRANTs refletem os comandos executados anteriormente na conversa.

BEGIN;

CREATE OR REPLACE FUNCTION public.registrar_desligamento_associado(p_associate_id uuid, p_motivo text, p_data date, p_documento text, p_observacoes text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
    v_associado public.associates%ROWTYPE;
    v_responsavel uuid;
BEGIN
    IF (SELECT auth.uid()) IS NULL
       OR NOT COALESCE(public.can_manage_associates(), false)
    THEN
        RAISE EXCEPTION 'Usuário não autorizado.';
    END IF;

    IF p_associate_id IS NULL
       OR p_data IS NULL
       OR NULLIF(pg_catalog.btrim(p_documento), '') IS NULL
       OR pg_catalog.length(
           pg_catalog.btrim(COALESCE(p_observacoes, ''))
       ) < 10
    THEN
        RAISE EXCEPTION 'Informe todos os dados obrigatórios.';
    END IF;

    IF p_data > CURRENT_DATE THEN
        RAISE EXCEPTION 'Data futura não permitida.';
    END IF;

    IF p_motivo IS NULL OR p_motivo NOT IN (
        'voluntario',
        'exclusao_inadimplencia',
        'exclusao_outras_causas'
    ) THEN
        RAISE EXCEPTION 'Motivo inválido.';
    END IF;

    SELECT id INTO v_responsavel
    FROM public.profiles
    WHERE user_id = (SELECT auth.uid());

    IF v_responsavel IS NULL THEN
        RAISE EXCEPTION 'Responsável não localizado.';
    END IF;

    SELECT * INTO v_associado
    FROM public.associates
    WHERE id = p_associate_id
    FOR UPDATE;

    IF NOT FOUND OR v_associado.status <> 'ativo' THEN
        RAISE EXCEPTION 'Associado não localizado ou não ativo.';
    END IF;

    IF v_associado.joined_at IS NOT NULL
       AND p_data < v_associado.joined_at THEN
        RAISE EXCEPTION 'Data anterior ao ingresso.';
    END IF;

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
            ELSE 'Exclusão por outras causas estatutárias'
        END,
        p_data,
        v_responsavel,
        pg_catalog.btrim(p_documento),
        pg_catalog.btrim(p_observacoes)
    );

    RETURN p_associate_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.proteger_status_associado()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
    v_proprietario name;
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status
       AND (
           OLD.status = 'desligado'
           OR NEW.status = 'desligado'
       )
       OR OLD.left_at IS DISTINCT FROM NEW.left_at
    THEN
        SELECT pg_catalog.pg_get_userbyid(p.proowner)
        INTO v_proprietario
        FROM pg_catalog.pg_proc p
        WHERE p.oid =
            'public.registrar_desligamento_associado(uuid,text,date,text,text)'
            ::pg_catalog.regprocedure;

        IF current_user IS DISTINCT FROM v_proprietario
           OR OLD.status <> 'ativo'
           OR NEW.status <> 'desligado'
           OR NEW.left_at IS NULL
           OR NOT COALESCE(public.can_manage_associates(), false)
        THEN
            RAISE EXCEPTION
                'Desligamento ou reativação exige procedimento autorizado.';
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

-- Vinculo da protecao ao cadastro de associados.
DROP TRIGGER IF EXISTS trg_proteger_status_associado ON public.associates;
CREATE TRIGGER trg_proteger_status_associado
BEFORE UPDATE OF status, left_at ON public.associates
FOR EACH ROW EXECUTE FUNCTION public.proteger_status_associado();

REVOKE ALL ON FUNCTION public.registrar_desligamento_associado(uuid,text,date,text,text)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_desligamento_associado(uuid,text,date,text,text)
TO authenticated;
REVOKE ALL ON FUNCTION public.proteger_status_associado()
FROM PUBLIC, anon, authenticated;

COMMIT;
