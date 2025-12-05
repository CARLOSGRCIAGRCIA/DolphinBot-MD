const fs = require("fs");
const path = require("path");

const PARTIDO_DATA_FILE = path.join(__dirname, "../data/partidoData.json");

const FORMATOS = {
  "4v4": {
    nombre: "4V4",
    equipos: 1,
    jugadoresPorEquipo: 4,
    suplentes: 3,
  },
  "6v6": {
    nombre: "6v6",
    equipos: 1,
    jugadoresPorEquipo: 6,
    suplentes: 3,
  },
  hexagonal: {
    nombre: "HEXAGONAL",
    equipos: 2,
    jugadoresPorEquipo: 4,
    suplentes: 3,
  },
  trilatero: {
    nombre: "TRILATERO",
    equipos: 3,
    jugadoresPorEquipo: 4,
    suplentes: 3,
  },
  cuadrilatero: {
    nombre: "CUADRILATERO",
    equipos: 4,
    jugadoresPorEquipo: 5,
    suplentes: 3,
  },
};

function loadPartidoData() {
  try {
    if (fs.existsSync(PARTIDO_DATA_FILE)) {
      return JSON.parse(fs.readFileSync(PARTIDO_DATA_FILE, "utf8"));
    }
  } catch (error) {
    console.error("Error loading partido data:", error);
  }
  return {};
}

function savePartidoData(data) {
  try {
    const dir = path.dirname(PARTIDO_DATA_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(PARTIDO_DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error saving partido data:", error);
  }
}

function generarListaPartido(
  formato,
  hora = "----",
  color = "----",
  jugadores = {}
) {
  const config = FORMATOS[formato];
  if (!config) return null;

  // Función para sumar una hora
  function sumarUnaHora(horaStr) {
    if (horaStr === "----") return "----";

    try {
      // Verificar si la hora tiene formato HH:MM o H:MM
      const match = horaStr.match(/^(\d{1,2}):(\d{2})$/);
      if (!match) return horaStr; // Si no tiene formato válido, retornar original

      let horas = parseInt(match[1]);
      let minutos = parseInt(match[2]);

      // Sumar una hora
      horas += 1;

      // Si pasa de las 23, ajustar a 00
      if (horas >= 24) {
        horas = horas % 24;
      }

      // Formatear a 2 dígitos
      const horasStr = horas.toString().padStart(2, "0");
      const minutosStr = minutos.toString().padStart(2, "0");

      return `${horasStr}:${minutosStr}`;
    } catch (error) {
      console.error("Error al sumar hora:", error);
      return horaStr;
    }
  }

  // Calcular hora de Colombia (MX + 1 hora)
  const horaColombia = sumarUnaHora(hora);

  let mensaje = `_*${config.nombre}*_\n`;
  mensaje += `            _*ROPA ${color}*_\n`;
  mensaje += `    𝐇𝐎𝐑𝐀𝐑𝐈𝐎\n`;
  mensaje += `    🇲🇽 𝐌𝐄𝐗 : ${hora}\n`;
  mensaje += `    🇨🇴 𝐂𝐎𝐋 : ${horaColombia}\n\n`;
  mensaje += `    ¬ 𝐉𝐔𝐆𝐀𝐃𝐎𝐑𝐄𝐒 𝐏𝐑𝐄𝐒𝐄𝐍𝐓𝐄𝐒\n`;

  const mentions = [];

  for (let i = 1; i <= config.equipos; i++) {
    if (config.equipos === 1) {
      mensaje += `\n          𝗘𝗦𝗖𝗨𝗔𝗗𝗥𝗔\n\n`;
    } else {
      mensaje += `\n          𝗘𝗦𝗖𝗨𝗔𝗗𝗥𝗔 ${i}\n\n`;
    }

    const capitan = jugadores[`equipo${i}`]?.[0];
    if (capitan) {
      if (typeof capitan === "object" && capitan.whatsappId) {
        mensaje += `    👑 ┇ @${capitan.nombre}\n`;
        mentions.push(capitan.whatsappId);
      } else {
        mensaje += `    👑 ┇ @${capitan}\n`;
      }
    } else {
      mensaje += `    👑 ┇ \n`;
    }

    for (let j = 1; j < config.jugadoresPorEquipo; j++) {
      const jugador = jugadores[`equipo${i}`]?.[j];
      if (jugador) {
        if (typeof jugador === "object" && jugador.whatsappId) {
          mensaje += `    🥷🏻 ┇ @${jugador.nombre}\n`;
          mentions.push(jugador.whatsappId);
        } else {
          mensaje += `    🥷🏻 ┇ @${jugador}\n`;
        }
      } else {
        mensaje += `    🥷🏻 ┇ \n`;
      }
    }
  }

  mensaje += `\n    ㅤʚ 𝐒𝐔𝐏𝐋𝐄𝐍𝐓𝐄:\n`;
  for (let i = 0; i < config.suplentes; i++) {
    const suplente = jugadores.suplentes?.[i];
    if (suplente) {
      if (typeof suplente === "object" && suplente.whatsappId) {
        mensaje += `    🥷🏻 ┇ @${suplente.nombre}\n`;
        mentions.push(suplente.whatsappId);
      } else {
        mensaje += `    🥷🏻 ┇ @${suplente}\n`;
      }
    } else {
      mensaje += `    🥷🏻 ┇ \n`;
    }
  }

  return { mensaje, mentions };
}

function agregarJugador(chatId, messageId, jugadorInfo, posicion = null) {
  const data = loadPartidoData();
  const partidoKey = `${chatId}_${messageId}`;

  if (!data[partidoKey]) {
    return { success: false, message: "Lista no encontrada" };
  }

  const partido = data[partidoKey];
  const config = FORMATOS[partido.formato];

  let jugador = jugadorInfo;
  if (typeof jugadorInfo === "string") {
    jugador = { nombre: jugadorInfo, whatsappId: null };
  }

  for (let key in partido.jugadores) {
    if (Array.isArray(partido.jugadores[key])) {
      const yaEsta = partido.jugadores[key].some((j) => {
        if (typeof j === "object" && j.whatsappId) {
          return (
            j.whatsappId === jugador.whatsappId || j.nombre === jugador.nombre
          );
        }
        return j === jugador.nombre;
      });

      if (yaEsta) {
        return { success: false, message: "Ya estás en la lista" };
      }
    }
  }

  if (!posicion) {
    for (let i = 1; i <= config.equipos; i++) {
      const equipoKey = `equipo${i}`;
      if (!partido.jugadores[equipoKey]) {
        partido.jugadores[equipoKey] = [];
      }
      if (partido.jugadores[equipoKey].length < config.jugadoresPorEquipo) {
        partido.jugadores[equipoKey].push(jugador);
        savePartidoData(data);
        return { success: true, actualizado: partido };
      }
    }

    if (!partido.jugadores.suplentes) {
      partido.jugadores.suplentes = [];
    }
    if (partido.jugadores.suplentes.length < config.suplentes) {
      partido.jugadores.suplentes.push(jugador);
      savePartidoData(data);
      return { success: true, actualizado: partido };
    }

    return { success: false, message: "Lista llena" };
  }

  return { success: false, message: "Posición no válida" };
}

function removerJugador(chatId, messageId, jugadorInfo) {
  const data = loadPartidoData();
  const partidoKey = `${chatId}_${messageId}`;

  if (!data[partidoKey]) {
    return { success: false, message: "Lista no encontrada" };
  }

  const partido = data[partidoKey];
  let encontrado = false;

  let jugador = jugadorInfo;
  if (typeof jugadorInfo === "string") {
    jugador = { nombre: jugadorInfo, whatsappId: null };
  }

  for (let key in partido.jugadores) {
    if (Array.isArray(partido.jugadores[key])) {
      const index = partido.jugadores[key].findIndex((j) => {
        if (typeof j === "object" && j.whatsappId) {
          return (
            j.whatsappId === jugador.whatsappId || j.nombre === jugador.nombre
          );
        }
        return j === jugador.nombre;
      });

      if (index > -1) {
        partido.jugadores[key].splice(index, 1);
        encontrado = true;
        break;
      }
    }
  }

  if (encontrado) {
    savePartidoData(data);
    return { success: true, actualizado: partido };
  }

  return { success: false, message: "Jugador no encontrado en la lista" };
}

async function partidoCommand(sock, chatId, message, args) {
  try {
    const formato = args[0]?.toLowerCase();

    if (!FORMATOS[formato]) {
      const formatosDisponibles = Object.keys(FORMATOS).join(", .");
      await sock.sendMessage(
        chatId,
        {
          text: `❌ Formato no válido.\n\n*Formatos disponibles:*\n.${formatosDisponibles}\n\n*Uso:*\n.trilatero [hora] [color]\n\n*Ejemplo:*\n.trilatero 18:00 Blanco\n.hexagonal 20:00\n.4v4`,
        },
        { quoted: message }
      );
      return;
    }

    const hora = args[1] || "----";
    const color = args.slice(2).join(" ") || "----";

    const result = generarListaPartido(formato, hora, color, {});

    if (!result) {
      await sock.sendMessage(
        chatId,
        {
          text: "❌ Error al generar la lista",
        },
        { quoted: message }
      );
      return;
    }

    const sentMsg = await sock.sendMessage(chatId, {
      text:
        result.mensaje +
        "\n\n_Reacciona con ✋ para entrar o ❌ para salir_" +
        "\n\n> ┈➤ 𝑻𝒉𝒖𝒏𝒅𝒆𝒓𝑩𝒐𝒕 ⚡ 𝐂𝐚𝐫𝐥𝐨𝐬 𝐆",
      mentions: result.mentions || [],
    });

    const data = loadPartidoData();

    const partidoKey = `${chatId}_${sentMsg.key.id}`;
    const partidoData = {
      formato: formato,
      hora: hora,
      color: color,
      jugadores: {},
      messageId: sentMsg.key.id,
      chatId: chatId,
      fromMeId: sentMsg.key.id,
      timestamp: Date.now(),
    };

    data[partidoKey] = partidoData;
    savePartidoData(data);
  } catch (error) {
    console.error("Error en partidoCommand:", error);
    await sock.sendMessage(
      chatId,
      {
        text: "❌ Error al crear la lista del partido",
      },
      { quoted: message }
    );
  }
}

module.exports = {
  partidoCommand,
  agregarJugador,
  removerJugador,
  generarListaPartido,
  loadPartidoData,
};
