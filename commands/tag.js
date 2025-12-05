const isAdmin = require("../lib/isAdmin");
const { downloadContentFromMessage } = require("@whiskeysockets/baileys");
const fs = require("fs");
const path = require("path");

async function downloadMediaMessage(message, mediaType) {
  const stream = await downloadContentFromMessage(message, mediaType);
  let buffer = Buffer.from([]);
  for await (const chunk of stream) {
    buffer = Buffer.concat([buffer, chunk]);
  }
  const filePath = path.join(
    __dirname,
    "../temp/",
    `${Date.now()}.${mediaType}`
  );
  fs.writeFileSync(filePath, buffer);
  return filePath;
}

async function tagCommand(
  sock,
  chatId,
  senderId,
  messageText,
  replyMessage,
  message
) {
  const { isSenderAdmin, isBotAdmin } = await isAdmin(sock, chatId, senderId);

  if (!isBotAdmin) {
    await sock.sendMessage(
      chatId,
      { text: "Please make the bot an admin first." },
      { quoted: message }
    );
    return;
  }

  if (!isSenderAdmin) {
    const stickerPath = "./assets/sticktag.webp";
    if (fs.existsSync(stickerPath)) {
      const stickerBuffer = fs.readFileSync(stickerPath);
      await sock.sendMessage(
        chatId,
        { sticker: stickerBuffer },
        { quoted: message }
      );
    }
    return;
  }

  const groupMetadata = await sock.groupMetadata(chatId);
  const participants = groupMetadata.participants;
  const mentionedJidList = participants.map((p) => p.id);

  const signature = "\n\n> 𝑻𝒉𝒖𝒏𝒅𝒆𝒓𝑩𝒐𝒕 ⚡ 𝑩𝒚 𝑪𝒂𝒓𝒍𝒐𝒔 𝑮";
  const addSignature = (text) => {
    if (!text) return signature.trim();
    if (text.includes("𝑻𝒉𝒖𝒏𝒅𝒆𝒓𝑩𝒐𝒕 ⚡ 𝑩𝒚 𝑪𝒂𝒓𝒍𝒐𝒔 𝑮")) return text;
    return text + signature;
  };

  if (replyMessage) {
    let messageContent = {};

    if (replyMessage.stickerMessage) {
      const filePath = await downloadMediaMessage(
        replyMessage.stickerMessage,
        "sticker"
      );
      messageContent = {
        sticker: { url: filePath },
        mentions: mentionedJidList,
      };
    } else if (replyMessage.imageMessage) {
      const filePath = await downloadMediaMessage(
        replyMessage.imageMessage,
        "image"
      );
      const caption = addSignature(
        messageText || replyMessage.imageMessage.caption || ""
      );
      messageContent = {
        image: { url: filePath },
        caption: caption,
        mentions: mentionedJidList,
      };
    } else if (replyMessage.videoMessage) {
      const filePath = await downloadMediaMessage(
        replyMessage.videoMessage,
        "video"
      );
      const caption = addSignature(
        messageText || replyMessage.videoMessage.caption || ""
      );
      messageContent = {
        video: { url: filePath },
        caption: caption,
        mentions: mentionedJidList,
      };
    } else if (replyMessage.conversation || replyMessage.extendedTextMessage) {
      const originalText =
        replyMessage.conversation || replyMessage.extendedTextMessage.text;
      messageContent = {
        text: addSignature(originalText),
        mentions: mentionedJidList,
      };
    } else if (replyMessage.documentMessage) {
      const filePath = await downloadMediaMessage(
        replyMessage.documentMessage,
        "document"
      );
      const caption = addSignature(messageText || "");
      messageContent = {
        document: { url: filePath },
        fileName: replyMessage.documentMessage.fileName,
        caption: caption,
        mentions: mentionedJidList,
      };
    }

    if (Object.keys(messageContent).length > 0) {
      await sock.sendMessage(chatId, messageContent);
    }
  } else {
    await sock.sendMessage(chatId, {
      text: addSignature(messageText || "Tagged message"),
      mentions: mentionedJidList,
    });
  }
}

module.exports = tagCommand;
