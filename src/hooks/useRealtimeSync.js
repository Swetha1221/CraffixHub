import { useEffect } from 'react';
import { useSelector } from 'react-redux';

export function useRealtimeSync(refetchFn, modules = []) {
  const { tick, lastEvent } = useSelector((state) => state.realtime);

  useEffect(() => {
    if (tick === 0) return;
    if (modules.length === 0 || !lastEvent?.module || modules.includes(lastEvent.module)) {
      refetchFn();
    }
  }, [tick]);
}
