// Mapeo pestaña (hoja del Excel de relevamiento) -> ítems de Airtable a comparar.
// Generado desde la planilla del cliente ('Respuesta'). NO editar a mano: regenerar
// desde la planilla si cambia. Solo incluye pestañas con ítem asignado (las vacías se ignoran).

export type Hotel = "HTL Urbano" | "HTL 9 de Julio" | "HTL City Baires";

export const HOTELES: Hotel[] = ["HTL Urbano", "HTL 9 de Julio", "HTL City Baires"];

/** Por hotel: nombre exacto de la pestaña -> ítem(s) de Airtable con los que se compara. */
export const MAPEO_PESTANA_ITEMS: Record<Hotel, Record<string, string[]>> = {
  "HTL Urbano": {
    "Pintura general habt.": [
      "Pintura Pared"
    ],
    "Pisos Madera": [
      "Piso Madera"
    ],
    "Cerradura Puertas": [
      "Cerradura"
    ],
    "Puerta Entrada": [
      "Puerta de ingreso Habtiacion"
    ],
    "Black out": [
      "Black out"
    ],
    "Voile-Wall": [
      "Voile"
    ],
    "Colchon": [
      "Colchon Matrimonial"
    ],
    "Mesas luz": [
      "Mesa de luz"
    ],
    "Pantallas": [
      "Pantalla"
    ],
    "Sillon": [
      "Sillon"
    ],
    "Silla Escrit.": [
      "Silla"
    ],
    "Almohadas": [
      "Almohada Cama"
    ],
    "Rieles + Bastones": [
      "Riel de Cortina"
    ],
    "Puerta Placard": [
      "Puerta Corrediza"
    ],
    "Espejo facial": [
      "Espejo Baño"
    ],
    "Bañera": [
      "Bañera"
    ],
    "Escritorio": [
      "Escritorio"
    ],
    "Vidrio ventanal": [
      "Vidrio Ventana"
    ],
    "Bachas-Sifones": [
      "Griferia Bacha"
    ],
    "Tablas Inodoro": [
      "Tapa de Inodoro"
    ],
    "Rejilla Inod-Bidet": [
      "Rejilla Baños"
    ],
    "TV": [
      "Televisor"
    ],
    "Frazadas": [
      "Frazada Cama"
    ],
    "Edredones": [
      "Edredones"
    ],
    "Cubre Sommier": [
      "Cubre Sommier"
    ],
    "Apliques Baño": [
      "Luminaria Baños"
    ],
    "Cerradura Ventana": [
      "Cerradura Ventana"
    ]
  },
  "HTL 9 de Julio": {
    "Blackouts": [
      "Black out"
    ],
    "Cortinas Voile": [
      "Voile"
    ],
    "Cementado de piso": [
      "Piso Cementado"
    ],
    "Pintura Habits.": [
      "Pintura Pared"
    ],
    "Venecitas": [
      "Venecitas"
    ],
    "Colchones": [
      "Colchon Matrimonial"
    ],
    "Cubre Sommier": [
      "Cubre Sommier"
    ],
    "Catre-colchon": [
      "Colchon Catre"
    ],
    "Mesas de luz": [
      "Mesa de luz"
    ],
    "Mesada": [
      "Mesada"
    ],
    "TV Marcas": [
      "Televisor"
    ],
    "Pantallas de veladores": [
      "Pantalla"
    ],
    "Sillas, Mesas": [
      "Silla"
    ],
    "Sillones": [
      "Sillon"
    ],
    "Tapa de inodoro": [
      "Tapa de Inodoro"
    ],
    "Vidrios": [
      "Vidrio Ventana"
    ],
    "Ventanas madera": [
      "Ventana"
    ],
    "Amenities-Dispenser": [
      "Amenities"
    ],
    "Almohadas": [
      "Almohada Cama"
    ]
  },
  "HTL City Baires": {
    "Flor Ducha": [
      "Griferia Flor de Ducha"
    ],
    "Techo Baño Pintar": [
      "Pintura Techo"
    ],
    "Cubre Sommier": [
      "Cubre Sommier"
    ],
    "Sillas": [
      "Silla"
    ],
    "Voile": [
      "Voile"
    ],
    "Black out": [
      "Black out"
    ],
    "Pisos": [
      "Piso Flotante"
    ],
    "Colchones": [
      "Colchon Matrimonial"
    ],
    "Catres": [
      "Colchon Catre"
    ],
    "Puerta de ingreso": [
      "Puerta de ingreso Habtiacion"
    ],
    "Sillones": [
      "Sillon"
    ],
    "Tabla Inodoro": [
      "Tapa de Inodoro"
    ],
    "Pantalla Veladores": [
      "Pantalla"
    ],
    "Pint. Habt": [
      "Pintura Pared"
    ],
    "Bañera": [
      "Bañera"
    ],
    "Puerta Baño": [
      "Puerta de baño"
    ],
    "Griferia": [
      "Griferia Bacha"
    ],
    "Brechado_VITRI Box Ducha+Bacha": [
      "Ducha"
    ],
    "Bachas vitrificado": [
      "Bacha Marmol"
    ],
    "Mesa ratona_Vieja": [
      "Mesa ratona"
    ],
    "Escritorio Mesada": [
      "Escritorio"
    ],
    "Burletes pta. ppal": [
      "Burletes puerta principal"
    ],
    "Espejo Baño": [
      "Espejo Baño"
    ],
    "Almohadas": [
      "Almohada Cama"
    ]
  }
};
