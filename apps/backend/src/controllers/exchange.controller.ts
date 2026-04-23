import { Request, Response } from 'express';
import { exchangeService, SUPPORTED_CURRENCIES } from '../services/exchange.service';

export const exchangeController = {
  async getRates(_req: Request, res: Response) {
    const rates = await exchangeService.getRates();
    res.json({ success: true, data: { rates, currencies: SUPPORTED_CURRENCIES } });
  },
};
