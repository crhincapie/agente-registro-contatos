export interface AlmacenamientoPort {
  leerFixture(ruta: string): Promise<string>;
  listarFixture(ruta: string): Promise<string[]>;
  leerSalida(ruta: string): Promise<string | null>;
  escribirSalida(ruta: string, contenido: string): Promise<void>;
  anexarSalida(ruta: string, linea: string): Promise<void>;
  copiarFixtureASalida(origen: string, destino: string): Promise<void>;
  exclusivo<T>(operacion: () => Promise<T>): Promise<T>;
}
