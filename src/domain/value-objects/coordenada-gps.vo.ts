export class CoordenadaGPS {
  constructor(
    public readonly latitud: number,
    public readonly longitud: number,
    public readonly direccion?: string,
    public readonly zonaCuadrante?: string,
  ) {
    if (latitud < -90 || latitud > 90) {
      throw new Error(`Latitud inválida: ${latitud}. Debe estar entre -90 y 90.`);
    }
    if (longitud < -180 || longitud > 180) {
      throw new Error(`Longitud inválida: ${longitud}. Debe estar entre -180 y 180.`);
    }
  }

  toJSON() {
    return {
      lat: this.latitud,
      lng: this.longitud,
      dir: this.direccion || '',
      zona_cuadrante: this.zonaCuadrante || '',
    };
  }
}
