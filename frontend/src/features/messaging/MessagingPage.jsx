import React, { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Bot, Image as ImageIcon, Mic, MessageCircle, Paperclip, Pencil, Plus, Search, Send, Smile, Square, Volume2, X } from "lucide-react";
import { chatAttachmentUrl } from "../../api";
import { EmptyState } from "../../components/common/EmptyState";
import { PageHeader } from "../../components/common/PageHeader";
import { safeImageUrl } from "../../utils/assets";
import { stageLabel } from "../../utils/stages";

const chatEmojiPalette = [
  "\u{1F600}", "\u{1F601}", "\u{1F602}", "\u{1F60A}", "\u{1F60D}", "\u{1F60E}", "\u{1F609}", "\u{1F642}", "\u{1F914}", "\u{1F62E}",
  "\u{1F622}", "\u{1F621}", "\u{1F44D}", "\u{1F44E}", "\u{1F44F}", "\u{1F64F}", "\u{1F4AA}", "\u{1F91D}", "\u{1F44C}", "\u{270C}\u{FE0F}",
  "\u{2705}", "\u{26A0}\u{FE0F}", "\u{274C}", "\u{1F525}", "\u{1F4A1}", "\u{1F4CC}", "\u{1F3AF}", "\u{1F680}", "\u{2B50}", "\u{1F3C6}",
  "\u{2764}\u{FE0F}", "\u{1F49A}", "\u{1F499}", "\u{1F49B}", "\u{1F49C}", "\u{1F48C}", "\u{1F4AC}", "\u{1F441}\u{FE0F}", "\u{1F4F7}", "\u{1F4CE}",
  "\u{1F4C4}", "\u{1F4CA}", "\u{1F4C8}", "\u{1F4DD}", "\u{1F4E6}", "\u{1F4E2}", "\u{1F514}", "\u{1F512}", "\u{1F511}", "\u{1F527}",
  "\u{1F6E0}\u{FE0F}", "\u{1F4BB}", "\u{1F4F1}", "\u{260E}\u{FE0F}", "\u{1F4E7}", "\u{1F551}", "\u{1F4C5}", "\u{1F4CD}", "\u{1F697}", "\u{2708}\u{FE0F}",
  "\u{1F37D}\u{FE0F}", "\u{2615}", "\u{1F382}", "\u{1F389}", "\u{1F308}", "\u{2600}\u{FE0F}", "\u{1F319}", "\u{1F331}", "\u{1F33F}", "\u{1F6A9}"
];

const arabicKeyboardRows = [
  ["\u0636", "\u0635", "\u062b", "\u0642", "\u0641", "\u063a", "\u0639", "\u0647", "\u062e", "\u062d", "\u062c"],
  ["\u0634", "\u0633", "\u064a", "\u0628", "\u0644", "\u0627", "\u062a", "\u0646", "\u0645", "\u0643", "\u0637"],
  ["\u0626", "\u0621", "\u0624", "\u0631", "\u0649", "\u0629", "\u0648", "\u0632", "\u0638", "\u062f", "\u0630"],
  ["\u0644\u0627", "\u0623", "\u0625", "\u0622", "\u060c", ".", "\u061f"]
];

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function requestDisplayName(request) {
  return request?.modificationNumber || request?.client || request?.product || "Modification sans reference";
}

function parseSelectedProducts(value) {
  return String(value || "")
    .split(/[,;]+/)
    .map((product) => product.trim())
    .filter(Boolean);
}

function normalizeReferenceValue(value) {
  return String(value || "").trim().toLowerCase();
}

function finishedProductDetailRows(product) {
  return [
    ["Client", product.client],
    ["Projet", product.project],
    ["PN produit fini", product.partNumber],
    ["Designation", product.designation],
    ["PN client", product.customerPn],
    ["Produit", product.product],
    ["Indice coiffe", product.coiffeIndex],
    ["Indice drawing", product.drawingIndex],
    ["Code reduit", product.reducedCode],
    ["Prix de vente", product.salePrice],
    ["Date integration production", product.productionIntegrationDate],
    ["Commentaires", product.comments]
  ];
}

function finishedProductAiSummary(product, requests = []) {
  const requestLines = requests.length === 0
    ? "Aucune modification ne contient actuellement ce produit fini."
    : requests.map((request, index) => `${index + 1}. ${requestDisplayName(request)}, motif ${request.modificationReason || "non renseigne"}, projet ${request.modificationProject || "-"}, client ${request.client || "-"}, phase ${stageLabel(request.currentStage, Boolean(request.newVersion))}, pilote ${request.pilot || "-"}, reception ${request.receptionDate || "-"}.`).join(" ");
  return [
    `Produit fini ${product.partNumber || "-"}: ${product.designation || "designation non renseignee"}.`,
    `Il est lie au client ${product.client || "-"}, au projet ${product.project || "-"} et au produit ${product.product || "-"}.`,
    `PN client: ${product.customerPn || "-"}, code reduit: ${product.reducedCode || "-"}, indice coiffe: ${product.coiffeIndex || "-"}, indice drawing: ${product.drawingIndex || "-"}.`,
    `Date d'integration production: ${product.productionIntegrationDate || "-"}, prix de vente: ${product.salePrice ? `${product.salePrice} euros` : "-"}.`,
    product.comments ? `Commentaires: ${product.comments}.` : "",
    `Modifications trouvees: ${requests.length}. ${requestLines}`
  ].filter(Boolean).join(" ");
}

function speakFinishedProductSummary(text, setSpeaking, warningAlert = () => {}) {
  if (!("speechSynthesis" in window) || typeof SpeechSynthesisUtterance === "undefined") {
    warningAlert("Lecture sonore indisponible", "La synthese vocale n'est pas disponible dans ce navigateur.");
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "fr-FR";
  utterance.rate = 0.95;
  utterance.pitch = 1;
  utterance.onend = () => setSpeaking(false);
  utterance.onerror = () => setSpeaking(false);
  setSpeaking(true);
  window.speechSynthesis.speak(utterance);
}

function stopFinishedProductSpeech(setSpeaking) {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
  setSpeaking(false);
}

function isImageAsset(contentType, url) {
  const type = String(contentType || "").toLowerCase();
  const path = String(url || "").toLowerCase();
  return type.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(path);
}

function isAudioAsset(contentType, url) {
  const type = String(contentType || "").toLowerCase();
  const path = String(url || "").toLowerCase();
  return type.startsWith("audio/") || /\.(webm|mp3|m4a|ogg|wav|aac)$/.test(path);
}

function formatRecordingDuration(seconds = 0) {
  const safeSeconds = Math.max(0, Number(seconds) || 0);
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}

export function ChatFloatingButton({ count = 0, onClick }) {
  return (
    <button className="chat-floating-button" type="button" title="Messagerie rapide" onClick={onClick}>
      <Pencil size={21} />
      {count > 0 && <span>{count > 9 ? "9+" : count}</span>}
    </button>
  );
}

function requestCreationTime(request) {
  const time = Date.parse(request?.createdAt || request?.receptionDate || "");
  return Number.isFinite(time) ? time : Number.MAX_SAFE_INTEGER;
}

export function AskAiFloatingButton({ onClick }) {
  return (
    <button className="chat-floating-button ask-ai-floating-button" type="button" title="Ask AI produit fini" onClick={onClick}>
      <Bot size={21} />
    </button>
  );
}

export function QuickAskAiPanel({ finishedProducts = [], requests = [], warningAlert, onClose, onOpenRequest }) {
  return (
    <aside className="quick-chat-panel quick-ask-ai-panel" aria-label="Ask AI rapide">
      <header className="quick-chat-header">
        <div>
          <strong>Ask AI</strong>
          <span>Recherche PN produit fini</span>
        </div>
        <button className="icon-button" type="button" title="Fermer" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div className="quick-ask-ai-body">
        <AskAiFinishedProductPage
          compact
          finishedProducts={finishedProducts}
          requests={requests}
          onOpenRequest={onOpenRequest}
        />
      </div>
    </aside>
  );
}

export function QuickChatPanel({
  currentUser,
  draft,
  file,
  fileInputRef,
  messages = [],
  selectedUser,
  sending,
  typingNotice,
  users = [],
  onClearFile,
  onCancelVoiceRecording,
  onClose,
  onDraftChange,
  onFileChange,
  onStartVoiceRecording,
  onStopVoiceRecording,
  onSelectUser,
  onSend,
  recordingDuration = 0,
  recordingSupported = true,
  recordingVoice = false
}) {
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [arabicKeyboardOpen, setArabicKeyboardOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [messageSearch, setMessageSearch] = useState("");
  const messagesEndRef = useRef(null);
  const visibleMessages = filterChatMessages(messages, messageSearch);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, selectedUser]);

  function insertEmoji(emoji) {
    onDraftChange(`${draft || ""}${emoji}`);
    setEmojiPickerOpen(false);
  }

  function handleArabicKey(key) {
    if (key === "backspace") {
      onDraftChange((draft || "").slice(0, -1));
      return;
    }
    onDraftChange(`${draft || ""}${key === "space" ? " " : key}`);
  }

  return (
    <aside className="quick-chat-panel" aria-label="Messagerie rapide">
      <header className="quick-chat-header">
        <div>
          <strong>Messagerie</strong>
          <span>{selectedUser ? chatUserName(selectedUser) : "Choisissez une discussion"}</span>
        </div>
        <button className="icon-button" type="button" title="Fermer" onClick={onClose}>
          <X size={18} />
        </button>
      </header>
      <div className="quick-chat-body">
        <div className="quick-chat-users">
          {users.map((user) => (
            <button
              className={selectedUser && chatTargetKey(user) === chatTargetKey(selectedUser) ? "quick-chat-user active" : "quick-chat-user"}
              key={chatTargetKey(user)}
              type="button"
              onClick={() => onSelectUser(chatTargetKey(user))}
              title={chatUserName(user)}
            >
              <UserAvatar user={user} />
              {chatUnreadCount(user) > 0 && <span className="quick-chat-unread">{chatUnreadCount(user) > 9 ? "9+" : chatUnreadCount(user)}</span>}
            </button>
          ))}
        </div>
        <section className="quick-chat-thread">
          {!selectedUser && (
            <EmptyState title="Aucune discussion" text="Selectionnez un contact ou un groupe." compact />
          )}
          {selectedUser && (
            <>
              <div className="quick-chat-messages">
                {messageSearch && visibleMessages.length === 0 && (
                  <EmptyState title="Aucun resultat" text="Aucun message ne correspond a la recherche." compact />
                )}
                {visibleMessages.map((message) => {
                  const own = isOwnChatMessage(message, currentUser);
                  const author = own ? currentUser : { fullName: message.senderName };
                  return (
                    <article className={own ? "chat-message own" : "chat-message"} key={message.id}>
                      {!own && <UserAvatar user={author} small />}
                      <div className="chat-bubble">
                        {!own && <strong>{message.senderName}</strong>}
                        {message.content && <ChatMessageText text={message.content} />}
                        {message.attachmentFileName && <ChatAttachment message={message} />}
                        <time dateTime={message.createdAt}>{chatMessageTime(message.createdAt)}</time>
                      </div>
                      {own && <UserAvatar user={author} small />}
                    </article>
                  );
                })}
                <span ref={messagesEndRef} />
              </div>
              {typingNotice && <div className="chat-typing-notice">{typingNotice}</div>}
              <form className="quick-chat-composer" onSubmit={onSend}>
                <input
                  className="chat-message-search"
                  value={messageSearch}
                  placeholder="Rechercher dans la discussion..."
                  onChange={(event) => setMessageSearch(event.target.value)}
                />
                <textarea value={draft} placeholder="Message..." rows={2} onChange={(event) => onDraftChange(event.target.value)} />
                <div className="chat-composer-actions">
                  <div className="chat-emoji-area">
                    <button className="icon-button" type="button" title="Ajouter un emoji" onClick={() => setEmojiPickerOpen((open) => !open)}>
                      <Smile size={18} />
                    </button>
                    {emojiPickerOpen && (
                      <div className="chat-emoji-picker" role="menu" aria-label="Palette emojis">
                        {chatEmojiPalette.map((emoji) => (
                          <button key={emoji} type="button" onClick={() => insertEmoji(emoji)}>
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="chat-keyboard-area">
                    <button className="icon-button arabic-keyboard-toggle" type="button" title="Clavier arabe" onClick={() => setArabicKeyboardOpen((open) => !open)}>
                      AR
                    </button>
                    {arabicKeyboardOpen && <ArabicKeyboard onKey={handleArabicKey} />}
                  </div>
                  <label className="icon-button chat-file-button" title="Joindre un fichier">
                    <Paperclip size={18} />
                    <input ref={fileInputRef} type="file" onChange={onFileChange} />
                  </label>
                  {recordingSupported && (
                    <button
                      className={recordingVoice ? "icon-button chat-voice-button recording" : "icon-button chat-voice-button"}
                      disabled={sending}
                      type="button"
                      title={recordingVoice ? "Arreter l'enregistrement vocal" : "Enregistrer un message vocal"}
                      onClick={recordingVoice ? onStopVoiceRecording : onStartVoiceRecording}
                    >
                      {recordingVoice ? <Square size={17} /> : <Mic size={18} />}
                    </button>
                  )}
                  {recordingVoice && (
                    <span className="chat-recording-chip">
                      <span />
                      {formatRecordingDuration(recordingDuration)}
                      <button type="button" title="Annuler l'enregistrement" onClick={onCancelVoiceRecording}>
                        <X size={14} />
                      </button>
                    </span>
                  )}
                  {file && (
                    <span className="chat-file-chip">
                      {isAudioAsset(file.type, file.name) ? <Mic size={14} /> : <Paperclip size={14} />}
                      {file.name}
                      <button type="button" title="Retirer le fichier" onClick={onClearFile}>
                        <X size={14} />
                      </button>
                    </span>
                  )}
                  <button className="primary-action chat-send-button" type="submit" disabled={sending || recordingVoice || (!draft.trim() && !file)}>
                    <Send size={16} />
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </aside>
  );
}

export function MessagingPage({
  currentUser,
  draft,
  file,
  fileInputRef,
  groupFormOpen,
  groupMemberIds = [],
  groupName,
  groupProjectName,
  messages = [],
  projects = [],
  selectedUserId,
  sending,
  typingNotice,
  users = [],
  onClearFile,
  onCancelVoiceRecording,
  onAddGroupMember,
  onCreateGroup,
  onDraftChange,
  onFileChange,
  onGroupMemberToggle,
  onGroupProjectChange,
  onRefresh,
  onSelectUser,
  onStartVoiceRecording,
  onStopVoiceRecording,
  onSend,
  recordingDuration = 0,
  recordingSupported = true,
  recordingVoice = false,
  setGroupFormOpen,
  setGroupName,
  setGroupProjectName
}) {
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [arabicKeyboardOpen, setArabicKeyboardOpen] = useState(false);
  const [membersDialogOpen, setMembersDialogOpen] = useState(false);
  const [messageSearch, setMessageSearch] = useState("");
  const messagesEndRef = useRef(null);
  const selectedUser = users.find((user) => chatTargetKey(user) === selectedUserId);
  const selectableUsers = users.filter((user) => (user.type || "user") === "user");
  const onlineCount = users.filter((user) => user.online).length;
  const visibleMessages = filterChatMessages(messages, messageSearch);
  const selectedGroupMembers = chatGroupMembers(selectedUser, users, currentUser);
  const selectedGroupMemberIdSet = new Set((selectedUser?.memberIds || []).map((id) => Number(id)));
  const addableGroupUsers = isChatGroup(selectedUser)
    ? selectableUsers.filter((user) => !selectedGroupMemberIdSet.has(Number(user.id)))
    : [];

  function insertEmoji(emoji) {
    onDraftChange(`${draft || ""}${emoji}`);
    setEmojiPickerOpen(false);
  }

  function handleArabicKey(key) {
    if (key === "backspace") {
      onDraftChange((draft || "").slice(0, -1));
      return;
    }
    onDraftChange(`${draft || ""}${key === "space" ? " " : key}`);
  }

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, selectedUserId]);

  useEffect(() => {
    setMembersDialogOpen(false);
  }, [selectedUserId]);

  return (
    <section className="page-content messaging-page">
      <PageHeader
        eyebrow="Communication"
        title="Messagerie"
        subtitle="Discussions internes, historique des echanges et notifications instantanees."
      />
      <div className="messaging-layout">
        <aside className="chat-users-panel" aria-label="Utilisateurs">
          <div className="chat-panel-title">
            <div>
              <h2>Utilisateurs</h2>
              <span>{onlineCount} connecte{onlineCount > 1 ? "s" : ""} maintenant</span>
            </div>
            <button className="icon-button" type="button" title="Actualiser" onClick={onRefresh}>
              <Search size={16} />
            </button>
          </div>
          <div className="chat-group-tools">
            <button className="secondary-action compact-action" type="button" onClick={() => setGroupFormOpen((open) => !open)}>
              <MessageCircle size={16} />
              Nouveau groupe
            </button>
            {groupFormOpen && (
              <form className="chat-group-form" onSubmit={onCreateGroup}>
                <input
                  value={groupName}
                  placeholder="Nom du groupe, ex: Projet J4U"
                  onChange={(event) => setGroupName(event.target.value)}
                />
                <select value={groupProjectName} onChange={(event) => onGroupProjectChange(event.target.value)}>
                  <option value="">Choisir un projet</option>
                  {projects.map((project) => (
                    <option key={project.name} value={project.name}>{project.name}</option>
                  ))}
                </select>
                {groupProjectName && (
                  <p className="chat-group-hint">
                    Membres par defaut depuis l'equipe projet. Vous pouvez ajuster la selection.
                  </p>
                )}
                <div className="chat-group-members">
                  {selectableUsers.map((user) => (
                    <label key={user.id}>
                      <input
                        checked={groupMemberIds.includes(user.id)}
                        type="checkbox"
                        onChange={() => onGroupMemberToggle(user.id)}
                      />
                      <span>{chatUserName(user)}</span>
                    </label>
                  ))}
                </div>
                <button className="primary-action compact-action" type="submit" disabled={sending}>
                  Creer
                </button>
              </form>
            )}
          </div>
          <div className="chat-user-list">
            {users.length === 0 && (
              <EmptyState
                icon={MessageCircle}
                title="Aucun utilisateur"
                text="La liste sera disponible des que des comptes actifs existent."
              />
            )}
            {users.map((user) => (
              <button
                className={chatTargetKey(user) === selectedUserId ? "chat-user-row active" : "chat-user-row"}
                key={chatTargetKey(user)}
                type="button"
                onClick={() => onSelectUser(chatTargetKey(user))}
              >
                <UserAvatar user={user} />
                <span className="chat-user-copy">
                  <strong>{chatUserName(user)}</strong>
                  <small>{user.latestMessage ? chatPreview(user.latestMessage, currentUser?.id) : presenceLabel(user)}</small>
                </span>
                {(user.type || "user") === "group"
                  ? <span className="group-badge">{user.memberCount || 0}</span>
                  : <span className={user.online ? "presence-dot online" : "presence-dot"} title={presenceLabel(user)} />}
                {chatUnreadCount(user) > 0 && <span className="chat-unread-badge">{chatUnreadCount(user) > 99 ? "99+" : chatUnreadCount(user)}</span>}
              </button>
            ))}
          </div>
        </aside>

        <section className="chat-thread-panel" aria-label="Discussion">
          {!selectedUser && (
            <EmptyState
              icon={MessageCircle}
              title="Selectionnez une discussion"
              text="Choisissez un utilisateur pour afficher l'historique et envoyer un message."
            />
          )}
          {selectedUser && (
            <>
              <header className="chat-thread-header">
                <UserAvatar user={selectedUser} />
                <div>
                  <h2>{chatUserName(selectedUser)}</h2>
                  {isChatGroup(selectedUser) ? (
                    <span className="chat-group-header-meta">
                      {selectedUser.projectName ? `Projet ${selectedUser.projectName}` : "Groupe"}
                      <button type="button" onClick={() => setMembersDialogOpen(true)}>
                        {selectedUser.memberCount || 0} membre{(selectedUser.memberCount || 0) > 1 ? "s" : ""}
                      </button>
                    </span>
                  ) : (
                    <span>{presenceLabel(selectedUser)}</span>
                  )}
                </div>
                <input
                  className="chat-message-search"
                  value={messageSearch}
                  placeholder="Rechercher..."
                  onChange={(event) => setMessageSearch(event.target.value)}
                />
              </header>
              {membersDialogOpen && isChatGroup(selectedUser) && (
                <GroupMembersDialog
                  addableUsers={addableGroupUsers}
                  currentUser={currentUser}
                  disabled={sending}
                  group={selectedUser}
                  members={selectedGroupMembers}
                  onAddMember={(userId) => onAddGroupMember?.(selectedUser.id, userId)}
                  onClose={() => setMembersDialogOpen(false)}
                  onPrivateChat={(member) => {
                    setMembersDialogOpen(false);
                    onSelectUser(chatTargetKey(member));
                  }}
                />
              )}

              <div className="chat-history">
                {messages.length === 0 && (
                  <EmptyState
                    icon={MessageCircle}
                    title="Aucun message"
                    text="Demarrez la discussion avec un message ou une piece jointe."
                  />
                )}
                {messageSearch && visibleMessages.length === 0 && (
                  <EmptyState
                    icon={Search}
                    title="Aucun resultat"
                    text="Aucun message ne correspond a votre recherche."
                    compact
                  />
                )}
                {visibleMessages.map((message) => {
                  const own = isOwnChatMessage(message, currentUser);
                  const author = own ? currentUser : { fullName: message.senderName };
                  return (
                  <article className={own ? "chat-message own" : "chat-message"} key={message.id}>
                    {!own && <UserAvatar user={author} small />}
                    <div className="chat-bubble">
                      {!own && <strong>{message.senderName}</strong>}
                      {message.content && <ChatMessageText text={message.content} />}
                      {message.attachmentFileName && (
                        <ChatAttachment message={message} />
                      )}
                      <time dateTime={message.createdAt}>{chatMessageTime(message.createdAt)}</time>
                    </div>
                    {own && <UserAvatar user={author} small />}
                  </article>
                );
                })}
                <span ref={messagesEndRef} />
              </div>
              {typingNotice && <div className="chat-typing-notice">{typingNotice}</div>}

              <form className="chat-composer" onSubmit={onSend}>
                <textarea
                  value={draft}
                  placeholder="Ecrire un message..."
                  rows={2}
                  onChange={(event) => onDraftChange(event.target.value)}
                />
                <div className="chat-composer-actions">
                  <div className="chat-emoji-area">
                    <button
                      className="icon-button"
                      type="button"
                      title="Ajouter un emoji"
                      onClick={() => setEmojiPickerOpen((open) => !open)}
                    >
                      <Smile size={18} />
                    </button>
                    {emojiPickerOpen && (
                      <div className="chat-emoji-picker" role="menu" aria-label="Palette emojis">
                        {chatEmojiPalette.map((emoji) => (
                          <button key={emoji} type="button" onClick={() => insertEmoji(emoji)}>
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="chat-keyboard-area">
                    <button className="icon-button arabic-keyboard-toggle" type="button" title="Clavier arabe" onClick={() => setArabicKeyboardOpen((open) => !open)}>
                      AR
                    </button>
                    {arabicKeyboardOpen && <ArabicKeyboard onKey={handleArabicKey} />}
                  </div>
                  <label className="icon-button chat-file-button" title="Joindre un fichier">
                    <Paperclip size={18} />
                    <input ref={fileInputRef} type="file" onChange={onFileChange} />
                  </label>
                  {recordingSupported && (
                    <button
                      className={recordingVoice ? "icon-button chat-voice-button recording" : "icon-button chat-voice-button"}
                      disabled={sending}
                      type="button"
                      title={recordingVoice ? "Arreter l'enregistrement vocal" : "Enregistrer un message vocal"}
                      onClick={recordingVoice ? onStopVoiceRecording : onStartVoiceRecording}
                    >
                      {recordingVoice ? <Square size={17} /> : <Mic size={18} />}
                    </button>
                  )}
                  {recordingVoice && (
                    <span className="chat-recording-chip">
                      <span />
                      {formatRecordingDuration(recordingDuration)}
                      <button type="button" title="Annuler l'enregistrement" onClick={onCancelVoiceRecording}>
                        <X size={14} />
                      </button>
                    </span>
                  )}
                  {file && (
                    <span className="chat-file-chip">
                      {isAudioAsset(file.type, file.name) ? <Mic size={14} /> : <Paperclip size={14} />}
                      {file.name}
                      <button type="button" title="Retirer le fichier" onClick={onClearFile}>
                        <X size={14} />
                      </button>
                    </span>
                  )}
                  <button className="primary-action chat-send-button" type="submit" disabled={sending || recordingVoice || (!draft.trim() && !file)}>
                    <Send size={16} />
                    {sending ? "Envoi..." : "Envoyer"}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </section>
  );
}

function ArabicKeyboard({ onKey }) {
  return (
    <div className="arabic-keyboard" dir="rtl" role="group" aria-label="Clavier arabe">
      {arabicKeyboardRows.map((row, rowIndex) => (
        <div className="arabic-keyboard-row" key={`arabic-row-${rowIndex}`}>
          {row.map((key) => (
            <button key={key} type="button" onClick={() => onKey(key)}>
              {key}
            </button>
          ))}
        </div>
      ))}
      <div className="arabic-keyboard-row controls">
        <button type="button" onClick={() => onKey("backspace")}>⌫</button>
        <button className="space" type="button" onClick={() => onKey("space")}>مسافة</button>
      </div>
    </div>
  );
}

function UserAvatar({ user, small = false }) {
  const label = chatUserName(user);
  const photoUrl = safeImageUrl(user?.profilePhotoUrl);
  const initials = label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase() || "?";
  return (
    <span className={(user?.type || "") === "group" ? (small ? "chat-avatar group small" : "chat-avatar group") : (small ? "chat-avatar small" : "chat-avatar")}>
      {photoUrl ? <img src={photoUrl} alt={label} /> : initials}
    </span>
  );
}

function ChatAttachment({ message }) {
  const href = chatAttachmentUrl(message.id);
  const isImage = isImageAsset(message.attachmentContentType, message.attachmentFileName);
  const isAudio = isAudioAsset(message.attachmentContentType, message.attachmentFileName);
  if (isAudio) {
    return (
      <div className="chat-attachment audio">
        <div>
          <Mic size={17} />
          <span>
            <strong>{message.attachmentFileName || "Message vocal"}</strong>
            {message.attachmentFileSize ? <small>{formatFileSize(message.attachmentFileSize)}</small> : null}
          </span>
        </div>
        <audio controls preload="metadata" src={href}>
          <a href={href} target="_blank" rel="noreferrer">Ecouter le message vocal</a>
        </audio>
      </div>
    );
  }
  return (
    <a className={isImage ? "chat-attachment image" : "chat-attachment"} href={href} target="_blank" rel="noreferrer">
      {isImage ? (
        <img src={href} alt={message.attachmentFileName || "Image jointe"} />
      ) : (
        <Paperclip size={18} />
      )}
      <span>
        <strong>{message.attachmentFileName || "Piece jointe"}</strong>
        {message.attachmentFileSize ? <small>{formatFileSize(message.attachmentFileSize)}</small> : null}
      </span>
      {isImage && <ImageIcon size={16} />}
    </a>
  );
}

function ChatMessageText({ text }) {
  const parts = splitTextWithLinks(text);
  return (
    <p>
      {parts.map((part, index) => part.url ? (
        <a href={part.url} key={`${part.text}-${index}`} target="_blank" rel="noreferrer">
          {part.text}
        </a>
      ) : (
        <Fragment key={`${part.text}-${index}`}>{part.text}</Fragment>
      ))}
    </p>
  );
}

function GroupMembersDialog({ addableUsers = [], currentUser, disabled = false, group, members = [], onAddMember, onClose, onPrivateChat }) {
  const [selectedMemberId, setSelectedMemberId] = useState("");

  function submitAddMember(event) {
    event.preventDefault();
    if (!selectedMemberId || !onAddMember) return;
    const result = onAddMember(Number(selectedMemberId));
    if (result?.then) {
      result.then(() => setSelectedMemberId(""));
    } else {
      setSelectedMemberId("");
    }
  }

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="chat-members-dialog" role="dialog" aria-modal="true" aria-label="Membres du groupe" onMouseDown={(event) => event.stopPropagation()}>
        <header>
          <div>
            <h2>Membres du groupe</h2>
            <span>{chatUserName(group)} - {members.length} membre{members.length > 1 ? "s" : ""}</span>
          </div>
          <button className="icon-button" type="button" title="Fermer" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <div className="chat-members-list">
          {members.length === 0 ? (
            <EmptyState title="Aucun membre" text="La liste des membres est indisponible." compact />
          ) : (
            members.map((member) => {
              const isCurrentUser = Number(member.id) === Number(currentUser?.id);
              return (
                <article className="chat-member-row" key={member.id || chatUserName(member)}>
                  <UserAvatar user={member} />
                  <div>
                    <strong>{chatUserName(member)}</strong>
                    <span>{isCurrentUser ? "Vous" : presenceLabel(member)}</span>
                  </div>
                  {!isCurrentUser && (
                    <button className="secondary-action compact-action" type="button" onClick={() => onPrivateChat(member)}>
                      <MessageCircle size={15} />
                      Discuter en prive
                    </button>
                  )}
                </article>
              );
            })
          )}
        </div>
        <form className="chat-group-add-member" onSubmit={submitAddMember}>
          <select disabled={disabled || addableUsers.length === 0} value={selectedMemberId} onChange={(event) => setSelectedMemberId(event.target.value)}>
            <option value="">{addableUsers.length === 0 ? "Tous les utilisateurs sont deja membres" : "Ajouter un utilisateur au groupe"}</option>
            {addableUsers.map((user) => (
              <option key={user.id} value={user.id}>{chatUserName(user)}</option>
            ))}
          </select>
          <button className="secondary-action compact-action" disabled={disabled || !selectedMemberId} type="submit">
            <Plus size={15} />
            Ajouter
          </button>
        </form>
      </section>
    </div>
  );
}

function chatUserName(user) {
  return user?.name || user?.fullName || user?.username || user?.email || "Utilisateur";
}

function isChatGroup(target) {
  return (target?.type || "user") === "group";
}

function chatGroupMembers(group, conversations = [], currentUser) {
  if (!isChatGroup(group)) return [];
  const memberIds = Array.isArray(group.memberIds) ? group.memberIds : [];
  const usersById = new Map(
    conversations
      .filter((conversation) => (conversation.type || "user") === "user")
      .map((user) => [Number(user.id), user])
  );
  if (currentUser?.id) {
    usersById.set(Number(currentUser.id), currentUser);
  }
  return memberIds.map((memberId) => usersById.get(Number(memberId)) || {
    id: memberId,
    fullName: `Utilisateur ${memberId}`
  });
}

function isOwnChatMessage(message, currentUser) {
  return Boolean(message) && Number(message.senderId) === Number(currentUser?.id);
}

export function chatTargetKey(target) {
  if (!target) return null;
  return `${target.type || "user"}:${target.id}`;
}

function chatUnreadCount(conversation) {
  return Math.max(0, Number(conversation?.unreadCount) || 0);
}

export function totalUnreadConversations(conversations = []) {
  return conversations.reduce((total, conversation) => total + chatUnreadCount(conversation), 0);
}

export function parseChatTarget(value) {
  if (!value) return { type: "user", id: null };
  const text = String(value);
  if (!text.includes(":")) return { type: "user", id: Number(text) };
  const [type, id] = text.split(":");
  return { type: type || "user", id: Number(id) };
}

function chatPreview(message, currentUserId) {
  if (!message) return "";
  const prefix = Number(message.senderId) === Number(currentUserId) || message.own ? "Vous : " : "";
  const text = message.content || message.attachmentFileName || "Piece jointe";
  return `${prefix}${text}`;
}

function filterChatMessages(messages = [], query = "") {
  const normalized = normalizeSearchText(query);
  if (!normalized) return messages;
  return messages.filter((message) => normalizeSearchText([
    message.senderName,
    message.recipientName,
    message.groupName,
    message.content,
    message.attachmentFileName,
    chatMessageTime(message.createdAt)
  ].filter(Boolean).join(" ")).includes(normalized));
}

function splitTextWithLinks(text = "") {
  const parts = [];
  const pattern = /((?:https?:\/\/|www\.)[^\s<]+)/gi;
  let lastIndex = 0;
  String(text).replace(pattern, (match, _url, offset) => {
    if (offset > lastIndex) {
      parts.push({ text: String(text).slice(lastIndex, offset) });
    }
    const trailingMatch = match.match(/[),.;:!?]+$/);
    const trailing = trailingMatch ? trailingMatch[0] : "";
    const cleanText = trailing ? match.slice(0, -trailing.length) : match;
    parts.push({
      text: cleanText,
      url: cleanText.startsWith("www.") ? `https://${cleanText}` : cleanText
    });
    if (trailing) {
      parts.push({ text: trailing });
    }
    lastIndex = offset + match.length;
    return match;
  });
  if (lastIndex < String(text).length) {
    parts.push({ text: String(text).slice(lastIndex) });
  }
  return parts.length ? parts : [{ text: String(text) }];
}

function chatMessageTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16).replace("T", " ");
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(date);
}

function presenceLabel(user) {
  if ((user?.type || "user") === "group") {
    const project = user.projectName ? `Projet ${user.projectName}` : "Groupe";
    return `${project} - ${user.memberCount || 0} membres`;
  }
  if (user?.online) return "Actif maintenant";
  if (!user?.lastSeenAt) return "Hors ligne";
  return `Vu ${chatMessageTime(user.lastSeenAt)}`;
}

export function formatFileSize(value) {
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) return "";
  if (size < 1024) return `${size} o`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} Ko`;
  return `${(size / (1024 * 1024)).toFixed(1)} Mo`;
}

export function AskAiFinishedProductPage({ compact = false, finishedProducts = [], requests = [], warningAlert = () => {}, onOpenRequest }) {
  const [pnQuery, setPnQuery] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const normalizedQuery = normalizeReferenceValue(pnQuery);
  const matchedProduct = useMemo(() => {
    if (!normalizedQuery) return null;
    return finishedProducts.find((product) => normalizeReferenceValue(product.partNumber) === normalizedQuery) || null;
  }, [finishedProducts, normalizedQuery]);
  const matchingRequests = useMemo(() => {
    if (!matchedProduct) return [];
    const partNumber = normalizeReferenceValue(matchedProduct.partNumber);
    return requests
      .filter((request) => parseSelectedProducts(request.finishedProducts).some((value) => normalizeReferenceValue(value) === partNumber))
      .sort((first, second) =>
        requestCreationTime(first) - requestCreationTime(second)
        || Number(first.id || 0) - Number(second.id || 0)
        || requestDisplayName(first).localeCompare(requestDisplayName(second), "fr", { sensitivity: "base" })
      );
  }, [matchedProduct, requests]);
  const productSummary = matchedProduct ? finishedProductAiSummary(matchedProduct, matchingRequests) : "";

  function handleSearch(event) {
    event.preventDefault();
    setHasSearched(true);
    stopFinishedProductSpeech(setSpeaking);
  }

  function handleSpeak() {
    if (!productSummary) return;
    speakFinishedProductSummary(productSummary, setSpeaking, warningAlert);
  }

  return (
    <section className={compact ? "ask-ai-page compact-ask-ai-page" : "ask-ai-page"}>
      {!compact && (
        <PageHeader
          eyebrow="Ask AI"
          title="Assistant produit fini"
          subtitle="Saisissez le PN d'un produit fini pour retrouver sa fiche complete et toutes les modifications ou il est inclus."
        />
      )}
      <section className="ask-ai-search-panel panel">
        <div className="ask-ai-orb" aria-hidden="true"><Bot size={30} /></div>
        <form className="ask-ai-search-form" onSubmit={handleSearch}>
          <label>
            PN produit fini
            <div className="input-with-icon">
              <Search size={17} />
              <input
                autoComplete="off"
                placeholder="Saisir le PN exact"
                value={pnQuery}
                onChange={(event) => {
                  setPnQuery(event.target.value);
                  setHasSearched(false);
                }}
              />
            </div>
          </label>
          <button className="primary-action" disabled={!pnQuery.trim()} type="submit">
            <Bot size={16} />
            Analyser
          </button>
        </form>
      </section>

      {!hasSearched && (
        <EmptyState title="Pret a analyser" text="Entrez un PN exact pour consulter les details du produit fini et son historique de modifications." compact />
      )}
      {hasSearched && !matchedProduct && (
        <EmptyState title="Produit fini introuvable" text="Aucun produit fini ne correspond a ce PN. Verifiez la reference ou importez-la dans les preferentiels." compact />
      )}
      {matchedProduct && (
        <section className="ask-ai-result-grid">
          <article className="panel ask-ai-product-card">
            <div className="section-title">
              <div>
                <h2>{matchedProduct.partNumber}</h2>
                <span>{matchedProduct.designation || "Designation non renseignee"}</span>
              </div>
              <span className="stage-pill teal">{matchingRequests.length} modification{matchingRequests.length > 1 ? "s" : ""}</span>
            </div>
            <div className="ask-ai-detail-grid">
              {finishedProductDetailRows(matchedProduct).map(([label, value]) => (
                <span key={label}>
                  <em>{label}</em>
                  <strong>{value || "-"}</strong>
                </span>
              ))}
            </div>
            <div className="ask-ai-speech-actions">
              <button className="primary-action" type="button" onClick={handleSpeak}>
                <Volume2 size={16} />
                Explication sonore
              </button>
              <button className="secondary-action" disabled={!speaking} type="button" onClick={() => stopFinishedProductSpeech(setSpeaking)}>
                <Square size={14} />
                Stop
              </button>
            </div>
          </article>

          <article className="panel ask-ai-summary-card">
            <div className="section-title">
              <div>
                <h2>Synthese AI</h2>
                <span>Resume lisible et vocalisable</span>
              </div>
            </div>
            <p>{productSummary}</p>
          </article>

          <article className="panel ask-ai-modifications-card">
            <div className="section-title">
              <div>
                <h2>Modifications liees</h2>
                <span>Demandes ECR contenant ce produit fini</span>
              </div>
            </div>
            {matchingRequests.length === 0 ? (
              <EmptyState title="Aucune modification" text="Ce produit fini existe dans le referentiel, mais aucune modification ne l'inclut actuellement." compact />
            ) : (
              <div className="ask-ai-request-list">
                {matchingRequests.map((request) => (
                  <button className="ask-ai-request-row" key={request.id} type="button" onClick={() => onOpenRequest(request)}>
                    <span>
                      <strong>{requestDisplayName(request)}</strong>
                      <small>{request.modificationProject || "-"} | {request.client || "-"} | {request.product || "-"}</small>
                    </span>
                    <span>
                      <em>{stageLabel(request.currentStage, Boolean(request.newVersion))}</em>
                      <small>Reception: {request.receptionDate || "-"}</small>
                    </span>
                    <span>
                      <em>Pilote</em>
                      <small>{request.pilot || "-"}</small>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </article>
        </section>
      )}
    </section>
  );
}
