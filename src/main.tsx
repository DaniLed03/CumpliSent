import "./installer-runtime/index-CPq14cHp.css";
import "./installer-runtime/index-CZxMdjln.js";

const DATABASE_PATH_CARD_ID = "server-database-path-card";

async function renderServerDatabasePathCard() {
  const serverConfig = document.querySelector(".server-config");
  const serverCard = serverConfig?.querySelector(".bg-card");

  if (!serverConfig || !serverCard || document.getElementById(DATABASE_PATH_CARD_ID)) {
    return;
  }

  const card = document.createElement("div");
  card.id = DATABASE_PATH_CARD_ID;
  card.className = "bg-card rounded-xl border border-border overflow-hidden";
  card.innerHTML = `
    <div class="p-4 border-b border-border flex items-center justify-between gap-3">
      <div class="min-w-0">
        <h3 class="text-sm font-semibold">Base de datos local</h3>
        <p class="text-[10px] text-muted-foreground">Ruta detectada por el modulo de servidor</p>
      </div>
      <button
        type="button"
        class="p-2 bg-accent rounded-lg hover:bg-accent/80 transition-colors flex-shrink-0"
        title="Actualizar ruta de la base de datos"
        data-refresh-db-path="true"
      >
        Actualizar
      </button>
    </div>
    <div class="p-4">
      <div class="flex items-center justify-between gap-2 bg-muted/40 rounded-lg px-3 py-2.5">
        <div class="min-w-0">
          <p class="text-[10px] text-muted-foreground uppercase font-medium">Leyendo desde</p>
          <p class="text-xs font-mono font-semibold truncate" data-db-path-text="true">Detectando ruta...</p>
        </div>
        <button
          type="button"
          class="p-1.5 hover:bg-accent rounded-md transition-colors flex-shrink-0 text-xs font-semibold"
          title="Copiar ruta"
          data-copy-db-path="true"
          hidden
        >
          Copiar
        </button>
      </div>
    </div>
  `;

  serverCard.insertAdjacentElement("afterend", card);

  const pathText = card.querySelector<HTMLElement>("[data-db-path-text]");
  const copyButton = card.querySelector<HTMLButtonElement>("[data-copy-db-path]");
  const refreshButton = card.querySelector<HTMLButtonElement>("[data-refresh-db-path]");

  const loadPath = async () => {
    try {
      const databasePath = await window.cumplimientosBackend.databasePath();
      if (pathText) {
        pathText.textContent = databasePath || "No se pudo detectar la ruta";
        pathText.title = databasePath || "";
      }
      if (copyButton) {
        copyButton.hidden = !databasePath;
        copyButton.dataset.path = databasePath || "";
      }
    } catch {
      if (pathText) {
        pathText.textContent = "No se pudo detectar la ruta";
        pathText.title = "";
      }
      if (copyButton) {
        copyButton.hidden = true;
        copyButton.dataset.path = "";
      }
    }
  };

  refreshButton?.addEventListener("click", loadPath);
  copyButton?.addEventListener("click", async () => {
    const databasePath = copyButton.dataset.path || "";
    if (!databasePath) return;
    await navigator.clipboard.writeText(databasePath);
    copyButton.textContent = "Copiado";
    window.setTimeout(() => {
      copyButton.textContent = "Copiar";
    }, 1600);
  });

  await loadPath();
}

const observer = new MutationObserver(() => {
  void renderServerDatabasePathCard();
});

observer.observe(document.documentElement, {
  childList: true,
  subtree: true,
});

void renderServerDatabasePathCard();
