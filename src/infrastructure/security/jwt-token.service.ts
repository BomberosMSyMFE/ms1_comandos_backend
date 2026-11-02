import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ITokenServicePort, TokenPayload } from '../../application/ports/token-service.port';

@Injectable()
export class JwtTokenService implements ITokenServicePort {
  constructor(private readonly jwtService: JwtService) {}

  async generarToken(payload: TokenPayload): Promise<string> {
    return this.jwtService.signAsync({
      sub: payload.sub,
      email: payload.email,
      rol: payload.rol,
    });
  }

  async verificarToken(token: string): Promise<TokenPayload> {
    const decoded = await this.jwtService.verifyAsync(token);
    return {
      sub: decoded.sub,
      email: decoded.email,
      rol: decoded.rol,
    };
  }
}
