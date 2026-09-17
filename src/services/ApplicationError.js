export class ApplicationError extends Error {
  constructor(error){ super(error?.code || 'UNEXPECTED_ERROR'); this.name='ApplicationError'; this.code=error?.code || 'UNEXPECTED_ERROR'; this.retryable=Boolean(error?.retryable); this.details=error?.details || {}; }
}
export function unwrapApplicationResult(result){ if(result?.ok) return result.data; throw new ApplicationError(result?.error); }
