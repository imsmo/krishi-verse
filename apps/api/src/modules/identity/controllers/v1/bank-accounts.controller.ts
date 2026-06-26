// modules/identity/controllers/v1/bank-accounts.controller.ts · tokenised payout destinations.
import { Controller, Get, Headers, Post, UseGuards } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { AuthGuard } from '../../../../core/auth/auth.guard';
import { PermissionsGuard } from '../../../../core/auth/permissions.guard';
import { ZodBody } from '../../../../core/http/zod.pipe';
import { CurrentContext } from '../../../../core/tenancy-context/current-context.decorator';
import { RequestContext } from '../../../../core/tenancy-context/request-context';
import { IDEMPOTENCY_SERVICE, IdempotencyService } from '../../../../core/idempotency/idempotency.service';
import { BadRequestError } from '../../../../shared/errors/app-error';
import { BankAccountService } from '../../services/bank-account.service';
import { CreateBankAccountSchema, CreateBankAccountDto } from '../../dto/create-bank-account.dto';
import { TokeniseBankAccountSchema, TokeniseBankAccountDto } from '../../dto/tokenise-bank-account.dto';

@Controller({ path: 'bank-accounts', version: '1' })
@UseGuards(AuthGuard, PermissionsGuard)
export class BankAccountsController {
  constructor(private readonly banks: BankAccountService, @Inject(IDEMPOTENCY_SERVICE) private readonly idem: IdempotencyService) {}
  @Get() list(@CurrentContext() ctx: RequestContext) { return this.banks.list(ctx.tenantId, ctx.userId).then((data) => ({ data })); }
  /** Add a pre-tokenised destination (UPI, or a vaultRef the client already holds). */
  @Post() async add(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(CreateBankAccountSchema) dto: CreateBankAccountDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    const data = await this.idem.remember(key, ctx.userId, 'identity.bank.add', () => this.banks.add(ctx.tenantId, ctx.userId, dto));
    return { data };
  }
  /** P1-16 · add a FULL bank account: send the raw account number + IFSC ONCE; the server tokenises it at the
   *  gateway and stores ONLY the vault ref + last-4 (raw number never persisted/logged). Idempotency-keyed. */
  @Post('tokenise') async addFull(@CurrentContext() ctx: RequestContext, @Headers('idempotency-key') key: string, @ZodBody(TokeniseBankAccountSchema) dto: TokeniseBankAccountDto) {
    if (!key) throw new BadRequestError('Idempotency-Key header required');
    const data = await this.idem.remember(key, ctx.userId, 'identity.bank.tokenise', () => this.banks.addFullBankAccount(ctx.tenantId, ctx.userId, dto));
    return { data };
  }
}
