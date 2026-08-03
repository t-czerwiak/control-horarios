import type { Diff } from "./comparar";

interface Props {
  diffs: Diff[];
  /** Índices seleccionados (los que se van a aplicar). */
  seleccion: Set<number>;
  onToggle: (i: number) => void;
  onToggleTodos: () => void;
}

/** Tabla de vista previa: qué hay hoy en Airtable y cómo quedaría cada campo. */
export default function DiffTable({ diffs, seleccion, onToggle, onToggleTodos }: Props) {
  return (
    <div className="tabla-wrap diff-wrap">
      <table className="tabla diff-tabla">
        <thead>
          <tr>
            <th>
              <input
                type="checkbox"
                checked={seleccion.size === diffs.length && diffs.length > 0}
                onChange={onToggleTodos}
                aria-label="Seleccionar todo"
              />
            </th>
            <th>Hab.</th>
            <th>Ítem</th>
            <th>Campo</th>
            <th>En Airtable</th>
            <th>Quedaría</th>
          </tr>
        </thead>
        <tbody>
          {diffs.map((d, i) => (
            <tr key={`${d.recordId}-${d.campo}`}>
              <td>
                <input
                  type="checkbox"
                  checked={seleccion.has(i)}
                  onChange={() => onToggle(i)}
                  aria-label={`Aplicar cambio en habitación ${d.habitacion}, ${d.item}`}
                />
              </td>
              <td className="num">{d.habitacion}</td>
              <td>{d.item}</td>
              <td>{d.campo}</td>
              <td className="diff-viejo">{d.enAirtable}</td>
              <td className="diff-nuevo">{d.quedaria}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
