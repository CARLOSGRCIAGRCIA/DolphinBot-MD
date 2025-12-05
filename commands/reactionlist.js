// commands/reactionlist.js
const fs = require("fs");
const path = require("path");

const LIST_DATA_PATH = path.join(__dirname, "../data/reactionLists.json");

// Initialize data file if it doesn't exist
function initializeDataFile() {
  if (!fs.existsSync(LIST_DATA_PATH)) {
    const initialData = {
      activeLists: {}, // { messageId: { emoji: 'emoji', title: 'title', participants: [] } }
    };
    fs.writeFileSync(LIST_DATA_PATH, JSON.stringify(initialData, null, 2));
  }
}

// Load reaction lists data
function loadListsData() {
  try {
    initializeDataFile();
    return JSON.parse(fs.readFileSync(LIST_DATA_PATH));
  } catch (error) {
    console.error("Error loading lists data:", error);
    return { activeLists: {} };
  }
}

// Save reaction lists data
function saveListsData(data) {
  try {
    fs.writeFileSync(LIST_DATA_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Error saving lists data:", error);
  }
}

// Command to create a new reaction list
async function createReactionList(sock, chatId, message, args) {
  try {
    const emoji = args[0]; // The emoji to track
    const listTitle = args.slice(1).join(" ") || "Lista sin título";

    if (!emoji) {
      await sock.sendMessage(
        chatId,
        {
          text: "❌ Uso: .createlist <emoji> <título>\n\nEjemplo:\n.createlist ✋ Lista de Asistencia\n.createlist ❌ Lista de Interesados",
        },
        { quoted: message }
      );
      return;
    }

    // Send the list message
    const listMessage = await sock.sendMessage(chatId, {
      text: `📋 *${listTitle}*\n\nReacciona con ${emoji} para unirte a la lista\n\n*Participantes:*\nNadie aún...`,
    });

    // Store the list configuration
    const data = loadListsData();
    const messageId = listMessage.key.id;

    data.activeLists[messageId] = {
      chatId: chatId,
      emoji: emoji,
      title: listTitle,
      participants: [],
      createdAt: new Date().toISOString(),
    };

    saveListsData(data);

    console.log(`✅ Lista creada con ID: ${messageId}, emoji: ${emoji}`);
  } catch (error) {
    console.error("Error creating reaction list:", error);
    await sock.sendMessage(
      chatId,
      {
        text: "❌ Error al crear la lista",
      },
      { quoted: message }
    );
  }
}

// Handle reaction to a message
async function handleReactionToList(sock, reaction) {
  try {
    const { key, reaction: emoji } = reaction;
    const messageId = key.id;
    const userId = reaction.key?.participant || reaction.key?.remoteJid;

    if (!userId) return;

    const data = loadListsData();
    const list = data.activeLists[messageId];

    // Check if this message is a tracked list
    if (!list) return;

    // Check if the reaction matches the tracked emoji
    if (emoji.text !== list.emoji) return;

    console.log(`🎯 Reacción detectada: ${emoji.text} de ${userId}`);

    // Add user to list if not already there
    const userIndex = list.participants.findIndex((p) => p.id === userId);

    if (emoji.text && userIndex === -1) {
      // User is joining the list
      list.participants.push({
        id: userId,
        joinedAt: new Date().toISOString(),
      });

      saveListsData(data);
      await updateListMessage(sock, list, messageId);
    } else if (!emoji.text && userIndex !== -1) {
      // User removed reaction (left the list)
      list.participants.splice(userIndex, 1);
      saveListsData(data);
      await updateListMessage(sock, list, messageId);
    }
  } catch (error) {
    console.error("Error handling reaction:", error);
  }
}

// Update the list message with current participants
async function updateListMessage(sock, list, messageId) {
  try {
    let participantsList = "";

    if (list.participants.length === 0) {
      participantsList = "Nadie aún...";
    } else {
      for (let i = 0; i < list.participants.length; i++) {
        const participant = list.participants[i];
        participantsList += `${i + 1}. @${participant.id.split("@")[0]}\n`;
      }
    }

    const updatedText = `📋 *${list.title}*\n\nReacciona con ${list.emoji} para unirte a la lista\n\n*Participantes:* (${list.participants.length})\n${participantsList}`;

    await sock.sendMessage(list.chatId, {
      text: updatedText,
      mentions: list.participants.map((p) => p.id),
      edit: messageId,
    });
  } catch (error) {
    console.error("Error updating list message:", error);
  }
}

// Command to close a list (stop tracking reactions)
async function closeReactionList(sock, chatId, message) {
  try {
    const quotedMsg =
      message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedMsgId =
      message.message?.extendedTextMessage?.contextInfo?.stanzaId;

    if (!quotedMsg || !quotedMsgId) {
      await sock.sendMessage(
        chatId,
        {
          text: "❌ Responde al mensaje de la lista que quieres cerrar con .closelist",
        },
        { quoted: message }
      );
      return;
    }

    const data = loadListsData();
    const list = data.activeLists[quotedMsgId];

    if (!list) {
      await sock.sendMessage(
        chatId,
        {
          text: "❌ Este mensaje no es una lista activa",
        },
        { quoted: message }
      );
      return;
    }

    // Generate final list
    let finalList = `📋 *${list.title}* - CERRADA\n\n*Participantes finales:* (${list.participants.length})\n`;

    if (list.participants.length === 0) {
      finalList += "Nadie se unió a esta lista";
    } else {
      for (let i = 0; i < list.participants.length; i++) {
        const participant = list.participants[i];
        finalList += `${i + 1}. @${participant.id.split("@")[0]}\n`;
      }
    }

    await sock.sendMessage(chatId, {
      text: finalList,
      mentions: list.participants.map((p) => p.id),
    });

    // Remove from active lists
    delete data.activeLists[quotedMsgId];
    saveListsData(data);
  } catch (error) {
    console.error("Error closing list:", error);
    await sock.sendMessage(
      chatId,
      {
        text: "❌ Error al cerrar la lista",
      },
      { quoted: message }
    );
  }
}

// Command to view all active lists
async function viewActiveLists(sock, chatId, message) {
  try {
    const data = loadListsData();
    const activeLists = Object.entries(data.activeLists).filter(
      ([_, list]) => list.chatId === chatId
    );

    if (activeLists.length === 0) {
      await sock.sendMessage(
        chatId,
        {
          text: "📋 No hay listas activas en este chat",
        },
        { quoted: message }
      );
      return;
    }

    let listsText = "📋 *Listas Activas:*\n\n";
    activeLists.forEach(([msgId, list], index) => {
      listsText += `${index + 1}. ${list.title}\n`;
      listsText += `   Emoji: ${list.emoji}\n`;
      listsText += `   Participantes: ${list.participants.length}\n\n`;
    });

    await sock.sendMessage(
      chatId,
      {
        text: listsText,
      },
      { quoted: message }
    );
  } catch (error) {
    console.error("Error viewing active lists:", error);
  }
}

module.exports = {
  createReactionList,
  handleReactionToList,
  closeReactionList,
  viewActiveLists,
};
