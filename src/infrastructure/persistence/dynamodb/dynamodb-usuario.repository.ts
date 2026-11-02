import { Injectable } from '@nestjs/common';
import { DynamoDBDocumentClient, GetCommand, PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { IUsuarioRepository } from '../../../domain/repositories/usuario.repository.interface';
import { Usuario } from '../../../domain/entities/usuario.entity';
import { RolUsuario } from '../../../domain/value-objects/rol-usuario.vo';

@Injectable()
export class DynamoDbUsuarioRepository implements IUsuarioRepository {
  private readonly tableName = 'tb_usuarios_sso';

  constructor(private readonly docClient: DynamoDBDocumentClient) {}

  async guardar(usuario: Usuario): Promise<void> {
    const item = {
      usuario_id: usuario.id,
      nombre_completo: usuario.nombreCompleto,
      email: usuario.email,
      password_hash: usuario.passwordHash,
      rol: usuario.rol,
      estacion_base: usuario.estacionBase,
      activo: usuario.activo,
      ultimo_login: usuario.ultimoLogin || null,
      created_at: usuario.createdAt,
    };

    await this.docClient.send(
      new PutCommand({
        TableName: this.tableName,
        Item: item,
      }),
    );
  }

  async buscarPorId(id: string): Promise<Usuario | null> {
    const response = await this.docClient.send(
      new GetCommand({
        TableName: this.tableName,
        Key: { usuario_id: id },
      }),
    );

    if (!response.Item) return null;
    return this.mapToDomain(response.Item);
  }

  async buscarPorEmail(email: string): Promise<Usuario | null> {
    const response = await this.docClient.send(
      new QueryCommand({
        TableName: this.tableName,
        IndexName: 'GSI_Email',
        KeyConditionExpression: 'email = :email',
        ExpressionAttributeValues: {
          ':email': email.trim().toLowerCase(),
        },
      }),
    );

    if (!response.Items || response.Items.length === 0) {
      return null;
    }

    return this.mapToDomain(response.Items[0]);
  }

  private mapToDomain(item: any): Usuario {
    return new Usuario(
      item.usuario_id,
      item.nombre_completo,
      item.email,
      item.password_hash,
      item.rol as RolUsuario,
      item.estacion_base,
      item.activo,
      item.ultimo_login || undefined,
      item.created_at,
    );
  }
}
