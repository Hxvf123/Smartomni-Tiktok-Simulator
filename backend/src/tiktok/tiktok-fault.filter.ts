import { ArgumentsHost, Catch, ExceptionFilter } from '@nestjs/common';
import type { Request, Response } from 'express';
import { SIMULATOR_FAULT_CODE, TiktokFault } from '../common/tiktok-fault';

/**
 * Renders simulator test faults in the TikTok error-envelope SHAPE (code/message/request_id).
 * Values are NOT TikTok's: code is a simulator sentinel and `simulator_fault` marks the body as a test fault.
 */
@Catch(TiktokFault)
export class TiktokFaultFilter implements ExceptionFilter {
  catch(exception: TiktokFault, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request & { requestId?: string }>();
    http.getResponse<Response>().status(exception.getStatus()).json({
      code: SIMULATOR_FAULT_CODE,
      message: `[simulator test-fault] ${(exception.getResponse() as { message: string }).message}`,
      request_id: req.requestId ?? 'unknown',
      simulator_fault: { kind: exception.kind, documented_in_tiktok_contract: false, listed_in_contract_fixtures: exception.inFixtures },
    });
  }
}
