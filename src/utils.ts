export const resObj = (status: number, message: string, data?: any) => {
  return {
    status,
    message,
    data: data || null,
  };
};
