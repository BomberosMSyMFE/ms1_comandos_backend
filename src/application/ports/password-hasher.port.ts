export interface IPasswordHasherPort {
  compare(plain: string, hash: string): Promise<boolean>;
  hash(plain: string): Promise<string>;
}
