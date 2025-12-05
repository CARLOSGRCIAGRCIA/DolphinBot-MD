const isAdmin = require("../lib/isAdmin");

async function tagAllCommand(sock, chatId, senderId, message) {
  try {
    const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

    if (!isBotAdmin) {
      await sock.sendMessage(
        chatId,
        { text: "⚠️ Please make ThunderBot an admin first." },
        { quoted: message }
      );
      return;
    }

    if (!isSenderAdmin) {
      await sock.sendMessage(
        chatId,
        { text: "⚠️ Only group admins can use the .tagall command." },
        { quoted: message }
      );
      return;
    }

    const groupMetadata = await sock.groupMetadata(chatId);
    const participants = groupMetadata.participants;

    if (!participants || participants.length === 0) {
      await sock.sendMessage(chatId, {
        text: "❌ No participants found in the group.",
      });
      return;
    }

    let messageText = "┌─────────────────\n";
    messageText += "│ ⚡ *𝑻𝑯𝑼𝑵𝑫𝑬𝑹𝑩𝑶𝑻 𝑪𝑨𝑳𝑳*\n";
    messageText += "└─────────────────\n\n";

    participants.forEach((participant) => {
      messageText += `⚡ @${participant.id.split("@")[0]}\n`;
    });

    messageText += `\n━━━━━━━━━━━━━━━\n`;
    messageText += `> 𝐁𝐲: 𝐂𝐚𝐫𝐥𝐨𝐬 𝐆`;

    await sock.sendMessage(chatId, {
      text: messageText,
      mentions: participants.map((p) => p.id),
    });
  } catch (error) {
    console.error("Error in tagall command:", error);
    await sock.sendMessage(chatId, {
      text: "❌ ThunderBot failed to tag all members.",
    });
  }
}

module.exports = tagAllCommand;
