"use client";

import React, { useState, useEffect, createContext, useContext } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import Navbar from "@/components/Navbar";
import GlobalSearchOverlay from "@/components/GlobalSearchOverlay";
import DeploymentModal from "@/components/DeploymentModal";
import ClientModal from "@/components/ClientModal";
import ServerModal from "@/components/ServerModal";
import { FeedbackProvider } from "@/components/Feedback";
import { ClientDeployment, Client, Server } from "@/types";

interface AppContextType {
  openSearch: () => void;
  openNewDeployment: (clientId?: string) => void;
  openEditDeployment: (deployment: ClientDeployment) => void;
  openNewClient: () => void;
  openEditClient: (client: Client) => void;
  openNewServer: () => void;
  openEditServer: (server: Server) => void;
  refreshTrigger: number;
  triggerRefresh: () => void;
}

const AppContext = createContext<AppContextType | null>(null);

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error("useApp must be used within AppLayoutClient");
  }
  return context;
}

export default function AppLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuthPage = pathname === "/login";
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Deployment modal
  const [isDeploymentModalOpen, setIsDeploymentModalOpen] = useState(false);
  const [deploymentToEdit, setDeploymentToEdit] = useState<ClientDeployment | null>(null);
  const [defaultClientId, setDefaultClientId] = useState<string | undefined>(undefined);

  // Client modal
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientToEdit, setClientToEdit] = useState<Client | null>(null);

  // Server modal
  const [isServerModalOpen, setIsServerModalOpen] = useState(false);
  const [serverToEdit, setServerToEdit] = useState<Server | null>(null);

  // Global refresh trigger for pages to listen to
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const triggerRefresh = () => setRefreshTrigger((prev) => prev + 1);

  // Keyboard shortcut Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const openSearch = () => setIsSearchOpen(true);

  const openNewDeployment = (clientId?: string) => {
    setDeploymentToEdit(null);
    setDefaultClientId(clientId);
    setIsDeploymentModalOpen(true);
  };

  const openEditDeployment = (deployment: ClientDeployment) => {
    setDeploymentToEdit(deployment);
    setDefaultClientId(deployment.client_id);
    setIsDeploymentModalOpen(true);
  };

  const openNewClient = () => {
    setClientToEdit(null);
    setIsClientModalOpen(true);
  };

  const openEditClient = (client: Client) => {
    setClientToEdit(client);
    setIsClientModalOpen(true);
  };

  const openNewServer = () => {
    setServerToEdit(null);
    setIsServerModalOpen(true);
  };

  const openEditServer = (server: Server) => {
    setServerToEdit(server);
    setIsServerModalOpen(true);
  };

  // The login screen renders full-bleed, without sidebar/navbar (which need a session)
  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <FeedbackProvider>
    <AppContext.Provider
      value={{
        openSearch,
        openNewDeployment,
        openEditDeployment,
        openNewClient,
        openEditClient,
        openNewServer,
        openEditServer,
        refreshTrigger,
        triggerRefresh,
      }}
    >
      <div className="flex min-h-screen bg-slate-950 text-slate-100">
        {/* Sidebar */}
        <Sidebar
          onOpenNewDeployment={() => openNewDeployment()}
          isOpenMobile={isMobileMenuOpen}
          onCloseMobile={() => setIsMobileMenuOpen(false)}
        />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <Navbar
            onOpenSearch={() => setIsSearchOpen(true)}
            onOpenMobileMenu={() => setIsMobileMenuOpen(true)}
            onOpenNewDeployment={() => openNewDeployment()}
            onOpenNewClient={() => openNewClient()}
          />
          <main className="flex-1 p-4 md:p-7 lg:p-10 max-w-[1680px] mx-auto w-full">
            {children}
          </main>
        </div>
      </div>

      {/* Global Modals */}
      <GlobalSearchOverlay
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />

      <DeploymentModal
        isOpen={isDeploymentModalOpen}
        onClose={() => setIsDeploymentModalOpen(false)}
        onSuccess={() => triggerRefresh()}
        deploymentToEdit={deploymentToEdit}
        defaultClientId={defaultClientId}
      />

      <ClientModal
        isOpen={isClientModalOpen}
        onClose={() => setIsClientModalOpen(false)}
        onSuccess={() => triggerRefresh()}
        clientToEdit={clientToEdit}
      />

      <ServerModal
        isOpen={isServerModalOpen}
        onClose={() => setIsServerModalOpen(false)}
        onSuccess={() => triggerRefresh()}
        serverToEdit={serverToEdit}
      />
    </AppContext.Provider>
    </FeedbackProvider>
  );
}
