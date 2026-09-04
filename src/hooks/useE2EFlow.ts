/**
 * useE2EFlow (P3) — Szenario-Liste + Flow-Runner-Mutation.
 */
import { useMutation, useQuery, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import {
    getRunnerScenarios,
    runE2EFlow,
    type E2EFlowResult,
    type RunE2EFlowInput,
    type RunnerScenarioInfo,
} from '@/api/e2eFlow';

export function useRunnerScenarios(): UseQueryResult<RunnerScenarioInfo[], Error> {
    return useQuery({
        queryKey: ['admin', 'bot-testing', 'scenarios'],
        queryFn: getRunnerScenarios,
        staleTime: 5 * 60_000,
        gcTime: 10 * 60_000,
    });
}

export function useRunE2EFlow(): UseMutationResult<E2EFlowResult, Error, RunE2EFlowInput> {
    return useMutation({
        mutationFn: (input) => runE2EFlow(input),
    });
}
