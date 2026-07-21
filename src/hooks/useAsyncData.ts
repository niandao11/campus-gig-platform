import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncDataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useAsyncData<T>(loader: () => Promise<T>, refreshKey: number): AsyncDataState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const reload = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const nextData = await loader();
      if (requestId.current === currentRequest) setData(nextData);
    } catch (loadError) {
      if (requestId.current === currentRequest) {
        setError(loadError instanceof Error ? loadError.message : "数据读取失败，请稍后重试");
      }
    } finally {
      if (requestId.current === currentRequest) setLoading(false);
    }
  }, [loader]);

  useEffect(() => {
    void reload();
    return () => {
      requestId.current += 1;
    };
  }, [refreshKey, reload]);

  return { data, loading, error, reload };
}
