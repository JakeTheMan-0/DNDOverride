/**
 * @name DNDOverridePlugin
 * @description Sends a Windows notification in Do Not Disturb mode.
 * @version 1.0.0
 * @author JakeTheMan
 */

module.exports = class DNDOverridePlugin {
    observer = null;
    soundModule = null;
    userStatus = null;
    messageListenerAttached = false;

    load() {
        console.log("DNDOverridePlugin loaded.");
    }

    start() {
        console.log("DNDOverridePlugin started.");
        this.requestNotificationPermission();
        this.findSoundModule();
        this.findUserStatus();
        this.attachMessageListener();
        this.monitorStatusChanges();
        this.setupObserverForNewMessages();
    }

    stop() {
        if (this.observer) {
            this.observer.disconnect();
            console.log("Observer disconnected.");
        }
        console.log("DNDOverridePlugin stopped.");
    }

    // Request permission for displaying notifications
    requestNotificationPermission() {
        if (Notification.permission === "default") {
            Notification.requestPermission().then((permission) => {
                if (permission === "granted") {
                    console.log("Notification permission granted.");
                } else {
                    console.warn("Notification permission denied.");
                }
            });
        }
    }

    // Find the sound module used by Discord
    findSoundModule() {
        this.soundModule = BdApi.findModule((m) => m && m.playSound);
        if (this.soundModule) {
            console.log("Sound module found.");
        } else {
            console.warn("Sound module not found. Retrying in 2 seconds...");
            setTimeout(() => this.findSoundModule(), 2000);
        }
    }

    // Detect the current user’s status
    findUserStatus() {
        const UserModule = BdApi.findModuleByProps("getCurrentUser");
        if (UserModule && UserModule.getCurrentUser()) {
            this.userStatus = UserModule.getCurrentUser().status;
            console.log("User status detected:", this.userStatus);
        } else {
            console.warn("User status not found. Retrying in 2 seconds...");
            setTimeout(() => this.findUserStatus(), 2000);
        }
    }

    // Monitor user status changes
    monitorStatusChanges() {
        const StatusStore = BdApi.findModuleByProps("isMobileOnline", "isDesktopOnline");
        if (StatusStore) {
            console.log("Monitoring user status changes.");
            const originalSetStatus = StatusStore.setStatus;
            StatusStore.setStatus = (status) => {
                this.userStatus = status;
                console.log("User status updated:", this.userStatus);
                return originalSetStatus.apply(StatusStore, arguments);
            };
        } else {
            console.warn("Status store not found. Retrying in 2 seconds...");
            setTimeout(() => this.monitorStatusChanges(), 2000);
        }
    }

    // Attach a listener for new messages
    attachMessageListener() {
        if (this.messageListenerAttached) return;
        const MessageStore = BdApi.findModuleByProps("receiveMessage");
        const ChannelStore = BdApi.findModuleByProps("getChannelId");
        if (MessageStore && ChannelStore) {
            console.log("Attaching message listener.");
            this.messageListenerAttached = true;
            const originalReceiveMessage = MessageStore.receiveMessage;
            MessageStore.receiveMessage = (channelId, message) => {
                originalReceiveMessage.apply(MessageStore, arguments);
                if (channelId === ChannelStore.getChannelId()) {
                    console.log("New message received in the current channel.");
                    this.sendNotification(message);
                    this.playNotificationSound();
                }
            };
        } else {
            console.warn("Message or Channel store not found. Retrying in 2 seconds...");
            setTimeout(() => this.attachMessageListener(), 2000);
        }
    }

    // Observe DOM changes for new messages
    setupObserverForNewMessages() {
        const findMessageContainer = () => {
            const messageContainer = document.querySelector("[class*=scrollerInner]");
            if (messageContainer) {
                console.log("Message container found, setting up observer.");
                this.observer = new MutationObserver((mutations) => {
                    mutations.forEach((mutation) => {
                        if (mutation.addedNodes.length > 0) {
                            console.log("New message detected via DOM mutation.");
                            this.sendNotification({ content: "New message" });
                            this.playNotificationSound();
                        }
                    });
                });
                this.observer.observe(messageContainer, { childList: true });
            } else {
                console.error("Message container not found, retrying in 2 seconds.");
                setTimeout(findMessageContainer, 2000); // Retry after 2 seconds
            }
        };
        findMessageContainer();
    }

    // Send a Windows notification with the message sender and content
    sendNotification(message) {
        const author = message.author ? message.author.username : "Unknown"; // Get the author's username
        const messageContent = message.content || "You have a new message!";
        
        if (Notification.permission === "granted") {
            const notification = new Notification(`${author} says:`, {
                body: messageContent,
                silent: true // Prevents the default Windows sound from playing
            });
            notification.onclick = () => {
                window.focus();
                notification.close();
            };
            console.log("Windows notification sent:", `${author} says: ${messageContent}`);
        } else {
            console.warn("Notification permission not granted.");
        }
    }

    // Play Discord's notification sound even in DND mode
    playNotificationSound() {
        if (this.soundModule) {
            console.log("Playing built-in Discord notification sound.");
            this.soundModule.playSound("message1", 0.5); // 'message1' is the default notification sound
        } else {
            console.warn("Sound module is not ready yet.");
        }
    }
};
