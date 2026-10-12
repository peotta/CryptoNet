// Modelo genérico de simulação de protocolos. Nada aqui conhece RSA ou Diffie-Hellman:
// qualquer protocolo (TLS 1.3, SSH, IPsec) pode ser descrito como participantes + etapas + eventos.

export type PartyId = string;

/** Categoria visual de um item (define cor, ícone e rótulo textual). */
export type ItemKind = 'param' | 'private' | 'public' | 'secret' | 'plain' | 'cipher' | 'signature';

export interface Entry {
  key: string;
  /** Rótulo com marcação simples: x_{i} para subscrito e x^{n} para sobrescrito. */
  label: string;
  value: string;
  kind: ItemKind;
}

export interface Operation {
  id: string;
  party: PartyId;
  title: string;
  /** Fórmula simbólica, p. ex. "A = g^{a} mod p". */
  formula: string;
  /** Fórmula com os valores substituídos. */
  substituted: string;
  result: string;
  kind: ItemKind;
}

export interface Message {
  id: string;
  from: PartyId;
  to: PartyId;
  label: string;
  /** Conteúdo exibido no inspetor de mensagens. */
  summary: string;
  kind: ItemKind;
  /** Participantes que conseguem ler a mensagem no canal (além do destinatário). */
  observers: PartyId[];
  /** Mensagem alterada por um atacante em trânsito. */
  tampered: boolean;
}

export interface Verdict {
  ok: boolean;
  text: string;
}

export type SimulationEvent =
  | { type: 'set'; party: PartyId; entry: Entry }
  | { type: 'compute'; operation: Omit<Operation, 'id'>; entry?: Entry }
  | {
      type: 'send';
      message: Omit<Message, 'id' | 'observers' | 'tampered'> & { observers?: PartyId[]; tampered?: boolean };
      /** Entradas gravadas no destinatário (e copiadas aos observadores). Vazio: apenas em trânsito. */
      deliver: Entry[];
      /** Entradas copiadas aos observadores (se omitido, as mesmas de deliver). */
      observerEntries?: Entry[];
    }
  | { type: 'verdict'; verdict: Verdict };

export interface ProtocolStep {
  id: string;
  title: string;
  description: string;
  /** Operação executada, em uma frase. */
  operation: string;
  events: SimulationEvent[];
  /** Informações adicionais exibidas junto da etapa. */
  info?: string[];
}

export interface SlotDef {
  key: string;
  label: string;
  kind: ItemKind;
}

export interface PartyDef {
  id: PartyId;
  name: string;
  role: string;
  /** Posição no cenário; define também de onde as mensagens saem no canal. */
  position: 'left' | 'center' | 'right';
  slots: SlotDef[];
  /** Observador do canal (ex.: Eva). */
  adversary?: boolean;
}

export interface ProtocolDefinition {
  id: string;
  title: string;
  parties: PartyDef[];
  steps: ProtocolStep[];
}

export interface SimulationState {
  entries: Record<PartyId, Record<string, Entry>>;
  /** Operações executadas na etapa atual. */
  operations: Operation[];
  /** Mensagens em trânsito na etapa atual (animadas no canal). */
  transit: Message[];
  /** Histórico cumulativo de mensagens. */
  log: Message[];
  verdict: Verdict | null;
}

export interface Timeline {
  definition: ProtocolDefinition;
  /** states[0] é o estado inicial; states[i + 1] é o estado depois da etapa i. */
  states: SimulationState[];
}
