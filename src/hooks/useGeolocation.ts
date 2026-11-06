'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { GeolocationState } from '@/types';

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  autoStart?: boolean;
}

export function useGeolocation(options: UseGeolocationOptions = {}) {
  const {
    enableHighAccuracy = true,
    timeout = 15000,
    maximumAge = 0,
    autoStart = true,
  } = options;

  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    timestamp: null,
    error: null,
    loading: true,
  });

  const [permissionDenied, setPermissionDenied] = useState(false);
  const watchIdRef = useRef<number | null>(null);

  const startWatching = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: 'Geolocalização não é suportada por este navegador.',
      }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));
    setPermissionDenied(false);

    const handleSuccess = (position: GeolocationPosition) => {
      setState({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: position.timestamp,
        error: null,
        loading: false,
      });
      setPermissionDenied(false);
    };

    const handleError = (error: GeolocationPositionError) => {
      let mensagem = 'Erro ao obter localização.';
      switch (error.code) {
        case error.PERMISSION_DENIED:
          mensagem = 'Permissão de localização foi negada pelo usuário.';
          setPermissionDenied(true);
          break;
        case error.POSITION_UNAVAILABLE:
          mensagem = 'Sinal de localização (GPS) indisponível no dispositivo.';
          break;
        case error.TIMEOUT:
          mensagem = 'Tempo limite esgotado ao tentar obter sinal de GPS.';
          break;
      }
      setState((prev) => ({
        ...prev,
        loading: false,
        error: mensagem,
      }));
    };

    // Inicia monitoramento contínuo
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy,
        timeout,
        maximumAge,
      }
    );
  }, [enableHighAccuracy, timeout, maximumAge]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null && typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const refreshLocation = useCallback(() => {
    stopWatching();
    startWatching();
  }, [stopWatching, startWatching]);

  useEffect(() => {
    if (autoStart) {
      startWatching();
    }
    return () => {
      stopWatching();
    };
  }, [autoStart, startWatching, stopWatching]);

  return {
    ...state,
    permissionDenied,
    startWatching,
    stopWatching,
    refreshLocation,
  };
}
