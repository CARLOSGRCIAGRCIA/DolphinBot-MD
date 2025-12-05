const {
  agregarJugador,
  removerJugador,
  generarListaPartido,
  loadPartidoData,
} = require("../commands/partida");

async function obtenerNombreUsuario(sock, userId, participantAlt, chatId) {
  try {
    let userName = null;
    const whatsappId =
      participantAlt || userId.replace("@lid", "@s.whatsapp.net");
    const phoneNumber = whatsappId.split("@")[0];

    try {
      const contacts = sock.ev?.contacts || sock.contacts;
      if (contacts && contacts[whatsappId]) {
        const contact = contacts[whatsappId];
        if (contact.notify && contact.notify.trim() !== "") {
          userName = contact.notify.trim();
          console.log("Nombre obtenido:", userName);
          return userName;
        }
      }
    } catch (e) {}

    if (chatId.endsWith("@g.us")) {
      try {
        const groupMetadata = await sock.groupMetadata(chatId);
        const participant = groupMetadata.participants.find((p) => {
          return (
            p.id === whatsappId ||
            p.id === userId ||
            p.id.split("@")[0] === phoneNumber
          );
        });

        if (participant) {
          if (participant.notify && participant.notify.trim() !== "") {
            userName = participant.notify.trim();
            return userName;
          }
          if (
            participant.verifiedName &&
            participant.verifiedName.trim() !== ""
          ) {
            userName = participant.verifiedName.trim();
            return userName;
          }
        }
      } catch (e) {}
    }

    return phoneNumber.replace(/\D/g, "");
  } catch (error) {
    console.error("❌ Error en obtenerNombreUsuario:", error);
    const fallbackId =
      participantAlt || userId.replace("@lid", "@s.whatsapp.net");
    return fallbackId.split("@")[0].replace(/\D/g, "");
  }
}

async function handlePartidoReaction(sock, reaction) {
  try {
    const { key, emoji, reactorKey } = reaction;

    const chatId = key.remoteJid;
    const messageId = key.id;
    const userId = reactorKey.participant || reactorKey.remoteJid;
    const participantAlt = key.participantAlt;

    if (emoji !== "✋" && emoji !== "❌") {
      console.log("Emoji no válido para partido:", emoji);
      return;
    }

    const whatsappId =
      participantAlt || userId.replace("@lid", "@s.whatsapp.net");

    const userName = await obtenerNombreUsuario(
      sock,
      userId,
      participantAlt,
      chatId
    );

    const jugadorInfo = {
      nombre: userName,
      whatsappId: whatsappId,
    };

    const data = loadPartidoData();
    const partidosEnChat = Object.entries(data).filter(([key, partido]) =>
      key.startsWith(chatId)
    );

    if (partidosEnChat.length === 0) {
      console.log("No hay partidos activos");
      return;
    }

    let partidoKey = `${chatId}_${messageId}`;
    let partido = data[partidoKey];

    if (!partido) {
      partidosEnChat.sort(
        (a, b) => (a[1].timestamp || 0) - (b[1].timestamp || 0)
      );
      partidoKey = partidosEnChat[partidosEnChat.length - 1][0];
      partido = partidosEnChat[partidosEnChat.length - 1][1];
    }

    let resultado;
    const partidoKeyParts = partidoKey.split("_");
    const extractedMessageId = partidoKeyParts[partidoKeyParts.length - 1];
    const extractedChatId = partidoKeyParts.slice(0, -1).join("_");

    if (emoji === "✋") {
      resultado = agregarJugador(
        extractedChatId,
        extractedMessageId,
        jugadorInfo
      );

      if (resultado.success) {
        const listResult = generarListaPartido(
          partido.formato,
          partido.hora,
          partido.color,
          resultado.actualizado.jugadores
        );

        const editKey = {
          remoteJid: chatId,
          fromMe: true,
          id: partido.fromMeId || extractedMessageId,
        };
        try {
          await sock.sendMessage(chatId, {
            text:
              listResult.mensaje +
              "\n\n_Reacciona con ✋ para entrar o ❌ para salir_",
            mentions: listResult.mentions,
            edit: editKey,
          });
        } catch (editError) {
          await sock.sendMessage(chatId, {
            text:
              listResult.mensaje +
              "\n\n_Reacciona con ✋ para entrar o ❌ para salir_",
            mentions: listResult.mentions,
          });
        }
      } else {
        if (resultado.message === "Lista llena") {
          const tempMsg = await sock.sendMessage(chatId, {
            text: `⚠️ @${userName}, la lista está llena`,
            mentions: [whatsappId],
          });
          setTimeout(async () => {
            try {
              await sock.sendMessage(chatId, { delete: tempMsg.key });
            } catch (e) {}
          }, 5000);
        } else if (resultado.message === "Ya estás en la lista") {
          const tempMsg = await sock.sendMessage(chatId, {
            text: `⚠️ @${userName}, ya estás en la lista`,
            mentions: [whatsappId],
          });
          setTimeout(async () => {
            try {
              await sock.sendMessage(chatId, { delete: tempMsg.key });
            } catch (e) {}
          }, 5000);
        }
      }
    } else if (emoji === "❌") {
      resultado = removerJugador(
        extractedChatId,
        extractedMessageId,
        jugadorInfo
      );

      if (resultado.success) {
        const listResult = generarListaPartido(
          partido.formato,
          partido.hora,
          partido.color,
          resultado.actualizado.jugadores
        );

        const editKey = {
          remoteJid: chatId,
          fromMe: true,
          id: partido.fromMeId || extractedMessageId,
        };

        try {
          await sock.sendMessage(chatId, {
            text:
              listResult.mensaje +
              "\n\n_Reacciona con ✋ para entrar o ❌ para salir_",
            mentions: listResult.mentions,
            edit: editKey,
          });
        } catch (editError) {
          await sock.sendMessage(chatId, {
            text:
              listResult.mensaje +
              "\n\n_Reacciona con ✋ para entrar o ❌ para salir_",
            mentions: listResult.mentions,
          });
        }
      } else {
        if (resultado.message === "Jugador no encontrado en la lista") {
          const tempMsg = await sock.sendMessage(chatId, {
            text: `⚠️ @${userName}, no estás en la lista`,
            mentions: [whatsappId],
          });
          setTimeout(async () => {
            try {
              await sock.sendMessage(chatId, { delete: tempMsg.key });
            } catch (e) {}
          }, 5000);
        }
      }
    }
  } catch (error) {
    console.error("Error manejando reacción:", error);
  }
}

module.exports = {
  handlePartidoReaction,
};
