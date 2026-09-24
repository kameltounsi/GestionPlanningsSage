import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import PropTypes from "prop-types";
import { X } from "lucide-react";
import "./AnnualCalendarDialog.css";

// Calendar dates use UTC internally to keep week arithmetic independent of DST.
export function calendarWeek(date) {
  const thursday = new Date(date);
  thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
  const year = thursday.getUTCFullYear();
  return { year, number: Math.ceil(((thursday - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7) };
}

export function calendarMonth(year, month) {
  const first = new Date(Date.UTC(year, month, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  return Array.from({ length: 6 }, (_, row) =>
    Array.from({ length: 7 }, (_, column) => new Date(Date.UTC(year, month, 1 - offset + row * 7 + column)))
  );
}

export function AnnualCalendarDialog({ onClose }) {
  const dialogRef = useRef(null);
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const year = today.getUTCFullYear();
  const currentWeek = calendarWeek(today);
  const monthFormat = new Intl.DateTimeFormat("fr-FR", { month: "long", timeZone: "UTC" });

  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      previousFocus?.focus();
    };
  }, []);

  return createPortal(
    <dialog ref={dialogRef} className="annual-calendar-dialog" aria-labelledby="annual-calendar-title"
      onCancel={(event) => { event.preventDefault(); onClose(); }}>
      <header className="annual-calendar-header">
        <div>
          <h2 id="annual-calendar-title">Calendrier {year}</h2>
          <p>Semaine courante : <strong>{currentWeek.number}</strong> · Numérotation ISO (lundi à dimanche)</p>
        </div>
        <button autoFocus className="secondary-action" type="button" onClick={onClose}>
          <X size={18} aria-hidden="true" /> Fermer
        </button>
      </header>
      <div className="annual-calendar-grid">
        {Array.from({ length: 12 }, (_, month) => (
          <table className="annual-calendar-month" key={month}>
            <caption>{monthFormat.format(new Date(Date.UTC(year, month, 1)))} {year}</caption>
            <thead><tr>{["Sem.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam.", "Dim."].map((day) => <th scope="col" key={day}>{day}</th>)}</tr></thead>
            <tbody>{calendarMonth(year, month).map((days, row) => {
              const week = calendarWeek(days[0]);
              const hasDates = days.some((date) => date.getUTCMonth() === month);
              const isCurrentWeek = hasDates && week.year === currentWeek.year && week.number === currentWeek.number;
              return <tr key={row} className={isCurrentWeek ? "annual-calendar-current-week" : undefined}>
                <th scope="row">{hasDates ? week.number : ""}</th>
                {days.map((date, column) => {
                  const inMonth = date.getUTCMonth() === month;
                  const isToday = inMonth && date.getTime() === today.getTime();
                  return <td key={column} className={column > 4 ? "annual-calendar-weekend" : undefined}>
                    {inMonth && <span className={isToday ? "annual-calendar-today" : undefined} aria-current={isToday ? "date" : undefined}>{date.getUTCDate()}</span>}
                  </td>;
                })}
              </tr>;
            })}</tbody>
          </table>
        ))}
      </div>
      <p className="annual-calendar-legend">Le jour actuel est entouré ; la semaine courante est surlignée.</p>
    </dialog>, document.body
  );
}

AnnualCalendarDialog.propTypes = { onClose: PropTypes.func.isRequired };
