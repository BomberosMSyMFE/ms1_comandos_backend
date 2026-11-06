import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from '../infrastructure/controllers/auth.controller';
import { LoginSsoUseCase } from '../application/use-cases/login-sso.use-case';
import { ValidarSesionUseCase } from '../application/use-cases/validar-sesion.use-case';
import { ListarOperadoresUseCase } from '../application/use-cases/listar-operadores.use-case';
import { DynamoDbUsuarioRepository } from '../infrastructure/persistence/dynamodb/dynamodb-usuario.repository';
import { JwtTokenService } from '../infrastructure/security/jwt-token.service';
import { BcryptPasswordHasher } from '../infrastructure/security/bcrypt-password-hasher';
import { JwtCookieAuthGuard } from '../infrastructure/security/guards/jwt-cookie-auth.guard';
import { RolesGuard } from '../infrastructure/security/guards/roles.guard';
import { EnvConfig } from '../infrastructure/config/env.config';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: EnvConfig.jwtSecret,
      signOptions: { expiresIn: '8h' },
    }),
  ],
  controllers: [AuthController],
  providers: [
    DynamoDbUsuarioRepository,
    JwtTokenService,
    BcryptPasswordHasher,
    JwtCookieAuthGuard,
    RolesGuard,
    {
      provide: LoginSsoUseCase,
      useFactory: (
        usuarioRepo: DynamoDbUsuarioRepository,
        tokenService: JwtTokenService,
        passwordHasher: BcryptPasswordHasher,
        logger: any,
      ) => new LoginSsoUseCase(usuarioRepo, tokenService, passwordHasher, logger),
      inject: [DynamoDbUsuarioRepository, JwtTokenService, BcryptPasswordHasher, 'IAppLoggerPort'],
    },
    {
      provide: ValidarSesionUseCase,
      useFactory: (usuarioRepo: DynamoDbUsuarioRepository, tokenService: JwtTokenService) =>
        new ValidarSesionUseCase(usuarioRepo, tokenService),
      inject: [DynamoDbUsuarioRepository, JwtTokenService],
    },
    {
      provide: ListarOperadoresUseCase,
      useFactory: (usuarioRepo: DynamoDbUsuarioRepository) =>
        new ListarOperadoresUseCase(usuarioRepo),
      inject: [DynamoDbUsuarioRepository],
    },
  ],
  exports: [
    JwtModule,
    JwtTokenService,
    BcryptPasswordHasher,
    JwtCookieAuthGuard,
    RolesGuard,
    DynamoDbUsuarioRepository,
    ListarOperadoresUseCase,
  ],
})
export class AuthModule {}

