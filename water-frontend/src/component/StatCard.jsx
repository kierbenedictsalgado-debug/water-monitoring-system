function StatCard({
  title,
  value,
  unit,
  note
}) {
  return (
    <div className="stat-card">
      <p>
        {title}
      </p>

      <h2>
        {value}

        {unit && (
          <small>{unit}</small>
        )}
      </h2>

      {note && (
        <span>
          {note}
        </span>
      )}
    </div>
  );
}

export default StatCard;