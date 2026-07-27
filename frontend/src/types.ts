export type Step = 'menu' | 'subcategory' | 'interaction' | 'escalation' | 'closed';

export interface Message {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  isStreaming?: boolean;
}

export const CATEGORIES = {
  Commerciale: [
    "Branchement", "Abonnement", "Résiliation", "Tarification", 
    "Solutions de paiement", "Services digitaux", "Service SMS", 
    "Demande d'attestations", "Réseau Commercial"
  ],
  Technique: [
    "Branchement", "Assainissement", "Eau", "Électricité", "Coupure des fournitures"
  ]
};
