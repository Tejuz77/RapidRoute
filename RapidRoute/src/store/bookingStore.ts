import { create } from 'zustand';

interface Seat {
  id: string;
  seat_number: string;
  deck: string;
  type: string;
  status: string;
  version: number;
  held_by?: string;
  held_until?: string;
  held_by_name?: string;
}

interface PassengerDetails {
  name: string;
  age: string;
  gender: string;
}

interface BookingState {
  selectedSeats: Seat[];
  holdExpiry: string | null;
  passengerDetails: PassengerDetails[];
  currentRouteId: string | null;
  currentRoute: any | null;
  setSelectedSeats: (seats: Seat[]) => void;
  addSelectedSeat: (seat: Seat) => void;
  removeSelectedSeat: (seatId: string) => void;
  setHoldExpiry: (expiry: string | null) => void;
  setPassengerDetails: (details: PassengerDetails[]) => void;
  setCurrentRoute: (route: any) => void;
  clearBooking: () => void;
}

export const useBookingStore = create<BookingState>((set) => ({
  selectedSeats: [],
  holdExpiry: null,
  passengerDetails: [],
  currentRouteId: null,
  currentRoute: null,

  setSelectedSeats: (seats) => set({ selectedSeats: seats }),

  addSelectedSeat: (seat) =>
    set((state) => ({
      selectedSeats: [...state.selectedSeats, seat],
    })),

  removeSelectedSeat: (seatId) =>
    set((state) => ({
      selectedSeats: state.selectedSeats.filter((s) => s.id !== seatId),
    })),

  setHoldExpiry: (expiry) => set({ holdExpiry: expiry }),

  setPassengerDetails: (details) => set({ passengerDetails: details }),

  setCurrentRoute: (route) =>
    set({ currentRoute: route, currentRouteId: route?.id || null }),

  clearBooking: () =>
    set({
      selectedSeats: [],
      holdExpiry: null,
      passengerDetails: [],
      currentRouteId: null,
      currentRoute: null,
    }),
}));
