export interface TokenPayload {
  sub: string;
  email: string;
  rol: string;
}

export interface ITokenServicePort {
  generarToken(payload: TokenPayload): Promise<string>;
  verificarToken(token: string): Promise<TokenPayload>;
}
