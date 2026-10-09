/**
 * OWNER    : Tanmay
 * DUE      : D1 16:00
 * TASK     :
 *   TanStack Query hooks: useLatestRun, useForecast(runId, validHour), useStation, useAttribution, useTrajectories, useSkill, useFleetExposure, useActions(status), useApprove/useReject mutations.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api, { fetchSummary, fetchForecastH3, fetchStationForecast, fetchAttribution, fetchTrajectories, fetchSkill, fetchFleetExposure, fetchActions } from '../lib/api';
import { useTimeStore } from '../stores/timeStore';

export function useLatestRun() {
  return useQuery({
    queryKey: ['latestRun'],
    queryFn: async () => {
      const data = (await fetchSummary()).data;
      // Seed the time store so getValidHour() works -> the forecast layer enables.
      if (data?.run_id && !useTimeStore.getState().runId) useTimeStore.getState().setRunId(data.run_id);
      return data;
    },
  });
}

export function useForecast(runId, validHour) {
  return useQuery({
    queryKey: ['forecast', runId, validHour],
    // Pass run_id + valid_hour (required by the real /forecast route; ignored in MOCK_MODE).
    queryFn: async () => (await fetchForecastH3(runId, validHour)).data,
    enabled: !!runId && !!validHour,
  });
}

export function useStation(stationId, runId) {
  return useQuery({
    queryKey: ['station', stationId, runId],
    queryFn: async () => (await fetchStationForecast(stationId)).data,
    enabled: !!stationId,
  });
}

export function useAttribution(date) {
  return useQuery({
    queryKey: ['attribution', date],
    queryFn: async () => (await fetchAttribution()).data,
    enabled: !!date,
  });
}

export function useTrajectories(runId, stationId) {
  return useQuery({
    queryKey: ['trajectories', runId, stationId],
    queryFn: async () => (await fetchTrajectories()).data,
    enabled: !!runId,
  });
}

export function useSkill(days = 7) {
  return useQuery({
    queryKey: ['skill', days],
    queryFn: async () => (await fetchSkill()).data,
  });
}

export function useFleetExposure(fleetId, date) {
  return useQuery({
    queryKey: ['fleetExposure', fleetId, date],
    queryFn: async () => (await fetchFleetExposure(fleetId)).data,
    enabled: !!fleetId && !!date,
  });
}

export function useActions(status = 'draft') {
  return useQuery({
    queryKey: ['actions', status],
    queryFn: async () => (await fetchActions()).data,
  });
}

export function useApprove() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.post(`/actions/${id}/approve`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['actions'] }),
  });
}

export function useReject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id) => (await api.post(`/actions/${id}/reject`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['actions'] }),
  });
}
