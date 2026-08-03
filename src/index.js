/**
 * CLOUDFLARE WORKER
 *
 * Este Worker:
 * 1. Sirve el dashboard desde la carpeta public.
 * 2. Consulta los JSON de Dropbox.
 * 3. Evita que los enlaces de Dropbox aparezcan en el navegador.
 *
 * Secrets necesarios:
 * - DROPBOX_ACOPIO_URL
 * - DROPBOX_STOCK_URL
 */

const HEADERS_JSON = {
  "Content-Type": "application/json; charset=UTF-8",
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Pragma": "no-cache",
  "Expires": "0",
  "X-Content-Type-Options": "nosniff"
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    try {
      // ==========================================================
      // API: MOVIMIENTOS DE ACOPIO
      // ==========================================================

      if (url.pathname === "/api/acopio") {
        return await obtenerJsonDropbox(
          env.DROPBOX_ACOPIO_URL,
          "PilasCanchaAcopio.json"
        );
      }

      // ==========================================================
      // API: PILAS ACTUALMENTE EN STOCK
      // ==========================================================

      if (url.pathname === "/api/stock") {
        return await obtenerJsonDropbox(
          env.DROPBOX_STOCK_URL,
          "PilasCanchaenStock.json"
        );
      }

      // ==========================================================
      // ARCHIVOS ESTÁTICOS DE /PUBLIC
      // ==========================================================

      return env.ASSETS.fetch(request);

    } catch (error) {
      console.error("Error general del Worker:", error);

      return respuestaJson(
        {
          error: "Error interno del Worker",
          detalle:
            error instanceof Error
              ? error.message
              : String(error)
        },
        500
      );
    }
  }
};


/**
 * Descarga y valida un archivo JSON desde Dropbox.
 */
async function obtenerJsonDropbox(enlaceDropbox, nombreArchivo) {
  if (!enlaceDropbox) {
    return respuestaJson(
      {
        error: `Falta configurar el enlace de ${nombreArchivo}`
      },
      500
    );
  }

  try {
    const urlDropbox = prepararUrlDropbox(enlaceDropbox);

    const respuesta = await fetch(urlDropbox, {
      method: "GET",

      headers: {
        "Accept": "application/json, text/plain, */*",
        "User-Agent": "Cloudflare-Worker-Pilas-Cancha/1.0"
      },

      redirect: "follow",

      cf: {
        cacheEverything: false,
        cacheTtl: 0
      }
    });

    if (!respuesta.ok) {
      return respuestaJson(
        {
          error: `No fue posible obtener ${nombreArchivo}`,
          estadoHttp: respuesta.status,
          estadoTexto: respuesta.statusText
        },
        502
      );
    }

    const texto = await respuesta.text();

    let datos;

    try {
      datos = JSON.parse(texto);
    } catch (errorJson) {
      return respuestaJson(
        {
          error: `${nombreArchivo} no devolvió un JSON válido`,
          detalle:
            errorJson instanceof Error
              ? errorJson.message
              : String(errorJson)
        },
        502
      );
    }

    return respuestaJson(datos, 200);

  } catch (error) {
    return respuestaJson(
      {
        error: `No fue posible obtener ${nombreArchivo}`,
        detalle:
          error instanceof Error
            ? error.message
            : String(error)
      },
      502
    );
  }
}


/**
 * Fuerza el enlace de Dropbox a descarga directa.
 */
function prepararUrlDropbox(enlace) {
  const url = new URL(enlace);

  url.searchParams.set("dl", "1");

  return url.toString();
}


/**
 * Genera una respuesta JSON estándar.
 */
function respuestaJson(datos, estado = 200) {
  return new Response(
    JSON.stringify(datos),
    {
      status: estado,
      headers: HEADERS_JSON
    }
  );
}
