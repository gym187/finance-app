import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, error: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: 'Dados inválidos',
      details: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // Prisma constraint errors
  if ((err as { code?: string }).code === 'P2002') {
    res.status(409).json({ success: false, error: 'Registro já existe' });
    return;
  }

  if ((err as { code?: string }).code === 'P2025') {
    res.status(404).json({ success: false, error: 'Registro não encontrado' });
    return;
  }

  console.error('Erro não tratado:', err);
  res.status(500).json({ success: false, error: 'Erro interno do servidor' });
};
