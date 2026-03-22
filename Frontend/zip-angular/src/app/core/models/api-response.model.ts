export interface ApiResponse<T> {
  code: number;
  data: T | null;
  message: string | null;
  isError: boolean;
}
