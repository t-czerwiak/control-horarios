import { useState } from "react";
import type { ResumenCambios } from "./comparar";

interface Props {
  resumen: ResumenCambios;
  hotel: string;
  /** Email del usuario que va a aplicar (queda a la vista, para saber quién sube). */
  usuario: string;
  onConfirmar: () => void;
  onCancelar: () => void;
}

/**
 * Confirmación antes de escribir en Airtable: muestra en detalle QUÉ se va a subir
 * y exige tildar una casilla para habilitar el botón. Es el último freno antes de
 * modificar la base real.
 */
export default function ConfirmarAplicar({
  resumen,
  hotel,
  usuario,
  onConfirmar,
  onCancelar,
}: Props) {
  const [entendido, setEntendido] = useState(false);
  const top = resumen.porItem.slice(0, 6);
  const resto = resumen.porItem.length - top.length;

  return (
    <div className="confirmar">
      <p className="confirmar__intro">
        Vas a <strong>modificar la base de Airtable</strong> de <strong>{hotel}</strong>.
        Revisá el resumen antes de continuar.
      </p>

      <div className="confirmar__cifras">
        <div className="cifra">
          <span className="cifra__num">{resumen.registros}</span>
          <span className="cifra__label">registros a modificar</span>
        </div>
        <div className="cifra">
          <span className="cifra__num">{resumen.habitaciones}</span>
          <span className="cifra__label">habitaciones</span>
        </div>
        <div className="cifra">
          <span className="cifra__num">{resumen.calificaciones}</span>
          <span className="cifra__label">calificaciones (★)</span>
        </div>
        <div className="cifra">
          <span className="cifra__num">{resumen.observaciones}</span>
          <span className="cifra__label">observaciones</span>
        </div>
      </div>

      <p className="confirmar__subtitulo">Cambios por ítem</p>
      <ul className="confirmar__items">
        {top.map((x) => (
          <li key={x.item}>
            <span>{x.item}</span>
            <strong>{x.cambios}</strong>
          </li>
        ))}
        {resto > 0 && (
          <li className="confirmar__items-resto">
            <span>y {resto} ítem(s) más</span>
          </li>
        )}
      </ul>

      <p className="confirmar__usuario">
        Se va a aplicar como <strong>{usuario}</strong>. Solo se tocan los campos{" "}
        <strong>Calificación</strong> y <strong>Observación</strong> de la tabla
        “Equipamiento por Espacio”. Esta acción no se puede deshacer desde la app.
      </p>

      <label className="confirmar__check">
        <input
          type="checkbox"
          checked={entendido}
          onChange={(e) => setEntendido(e.target.checked)}
        />
        Revisé los cambios y confirmo que quiero aplicarlos.
      </label>

      <div className="acciones">
        <button type="button" className="boton boton--secundario" onClick={onCancelar}>
          Volver
        </button>
        <button
          type="button"
          className="boton boton--primario"
          onClick={onConfirmar}
          disabled={!entendido}
        >
          Aplicar a Airtable
        </button>
      </div>
    </div>
  );
}
