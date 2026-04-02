import { createContext, useContext, useState, ReactNode } from "react";
import type { Tables } from "@/integrations/supabase/types";

type Card = Tables<"cards">;

interface CardContextType {
  isModalOpen: boolean;
  editingCard: Card | null;
  defaultDate: Date | null;
  defaultEndDate: Date | null;
  openCreateModal: (date?: Date, endDate?: Date) => void;
  openEditModal: (card: Card) => void;
  closeModal: () => void;
}

const CardContext = createContext<CardContextType>({
  isModalOpen: false,
  editingCard: null,
  defaultDate: null,
  defaultEndDate: null,
  openCreateModal: () => {},
  openEditModal: () => {},
  closeModal: () => {},
});

export const useCardModal = () => useContext(CardContext);

export const CardProvider = ({ children }: { children: ReactNode }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCard, setEditingCard] = useState<Card | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | null>(null);
  const [defaultEndDate, setDefaultEndDate] = useState<Date | null>(null);

  const openCreateModal = (date?: Date, endDate?: Date) => {
    setEditingCard(null);
    setDefaultDate(date ?? null);
    setDefaultEndDate(endDate ?? null);
    setIsModalOpen(true);
  };

  const openEditModal = (card: Card) => {
    setEditingCard(card);
    setDefaultDate(null);
    setDefaultEndDate(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingCard(null);
    setDefaultDate(null);
    setDefaultEndDate(null);
  };

  return (
    <CardContext.Provider
      value={{ isModalOpen, editingCard, defaultDate, defaultEndDate, openCreateModal, openEditModal, closeModal }}
    >
      {children}
    </CardContext.Provider>
  );
};
