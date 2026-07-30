import styles from "./lavella-arrow-icon.module.css";

export function LavellaArrowIcon({
  direction,
}: {
  direction: "previous" | "next";
}) {
  return (
    <span className={styles.container} aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        {direction === "previous" ? (
          <path d="M13.75 5.5 7.25 12l6.5 6.5M7.5 12h9.25" />
        ) : (
          <path d="m10.25 5.5 6.5 6.5-6.5 6.5M16.5 12H7.25" />
        )}
      </svg>
    </span>
  );
}
