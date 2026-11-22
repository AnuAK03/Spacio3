import React, { useEffect, useMemo, useState } from 'react';
import {
  Bike,
  Car,
  CheckCircle2,
  Plus,
  Trash2,
  Zap,
} from 'lucide-react';
import {
  DriverProfile,
  UserSession,
  VehicleProfile,
  VehicleType,
  WheelerCategory,
} from '../types/parkpool';

export interface DriverProfilePayload {
  fullName: string;
  email: string;
  phone: string;
  licenseNumber: string;
  licenseValidTill: string;
  wheelerCategory: WheelerCategory;
  vehicleType: VehicleType;
  vehicleModel: string;
  plateNumber: string;
  isEv: boolean;
  registeredVehicleId?: string;
}

export interface NewDriverVehiclePayload {
  wheelerCategory: WheelerCategory;
  vehicleType: VehicleType;
  vehicleModel: string;
  plateNumber: string;
  isEv: boolean;
}

interface DriverProfileViewProps {
  user: UserSession;
  existingProfile?: DriverProfile;
  vehicles: VehicleProfile[];
  selectedVehicleId: string;
  onSelectVehicle: (vehicleId: string) => void;
  onSaveProfile: (payload: DriverProfilePayload) => Promise<void>;
  onAddVehicle: (payload: NewDriverVehiclePayload) => Promise<void>;
  onDeleteVehicle: (vehicleId: string) => Promise<void>;
}

function extractVehicleModel(v: VehicleProfile): string {
  const idx = v.label.lastIndexOf('(');
  if (idx > 0 && v.label.includes(v.plateNumber)) {
    return v.label.slice(0, idx).trim();
  }
  return v.label;
}

export const DriverProfileView: React.FC<DriverProfileViewProps> = ({
  user,
  existingProfile,
  vehicles,
  selectedVehicleId,
  onSelectVehicle,
  onSaveProfile,
  onAddVehicle,
  onDeleteVehicle,
}) => {
  // Driver license & contact form state
  const [fullName, setFullName] = useState(existingProfile?.fullName || user.name);
  const [email] = useState(existingProfile?.email || user.email);
  const [phone, setPhone] = useState(existingProfile?.phone || '+91 98450 ');
  const [licenseNumber, setLicenseNumber] = useState(
    existingProfile?.licenseNumber || ''
  );
  const [licenseValidTill, setLicenseValidTill] = useState(
    existingProfile?.licenseValidTill || '2032-12-31'
  );
  const [firstWheelerCategory, setFirstWheelerCategory] = useState<WheelerCategory>(
    existingProfile?.wheelerCategory || 'four_wheeler'
  );
  const [firstVehicleType, setFirstVehicleType] = useState<VehicleType>(
    existingProfile?.vehicleType || 'suv'
  );
  const [firstVehicleModel, setFirstVehicleModel] = useState(
    existingProfile?.vehicleModel || ''
  );
  const [firstPlateNumber, setFirstPlateNumber] = useState(
    existingProfile?.plateNumber || ''
  );
  const [firstIsEv, setFirstIsEv] = useState(existingProfile?.isEv ?? false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Add-a-vehicle form state
  const [newWheelerCategory, setNewWheelerCategory] =
    useState<WheelerCategory>('four_wheeler');
  const [newVehicleType, setNewVehicleType] = useState<VehicleType>('hatchback');
  const [newVehicleModel, setNewVehicleModel] = useState('');
  const [newPlateNumber, setNewPlateNumber] = useState('');
  const [newIsEv, setNewIsEv] = useState(false);
  const [addingVehicle, setAddingVehicle] = useState(false);
  const [vehicleError, setVehicleError] = useState<string | null>(null);
  const [vehicleSuccessMsg, setVehicleSuccessMsg] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (existingProfile) {
      setFullName(existingProfile.fullName);
      setPhone(existingProfile.phone);
      setLicenseNumber(existingProfile.licenseNumber);
      setLicenseValidTill(existingProfile.licenseValidTill);
      setFirstWheelerCategory(existingProfile.wheelerCategory);
      setFirstVehicleType(existingProfile.vehicleType);
      setFirstVehicleModel(existingProfile.vehicleModel);
      setFirstPlateNumber(existingProfile.plateNumber);
      setFirstIsEv(existingProfile.isEv);
    }
  }, [existingProfile]);

  const myVehicles = useMemo(() => {
    const cleanEmail = user.email.trim().toLowerCase();
    return vehicles.filter(
      (v) =>
        v.ownerEmail?.toLowerCase() === cleanEmail ||
        (existingProfile?.registeredVehicleId &&
          v.id === existingProfile.registeredVehicleId)
    );
  }, [vehicles, user.email, existingProfile?.registeredVehicleId]);

  const activeVehicle = useMemo(
    () =>
      myVehicles.find((v) => v.id === selectedVehicleId) ||
      myVehicles[0] ||
      vehicles.find((v) => v.id === selectedVehicleId),
    [myVehicles, vehicles, selectedVehicleId]
  );

  const handleNewCategoryChange = (cat: WheelerCategory) => {
    setNewWheelerCategory(cat);
    if (cat === 'two_wheeler') {
      setNewVehicleType('two_wheeler');
    } else if (newVehicleType === 'two_wheeler') {
      setNewVehicleType('hatchback');
    }
  };

  const handleFirstCategoryChange = (cat: WheelerCategory) => {
    setFirstWheelerCategory(cat);
    if (cat === 'two_wheeler') {
      setFirstVehicleType('two_wheeler');
    } else if (firstVehicleType === 'two_wheeler') {
      setFirstVehicleType('hatchback');
    }
  };

  const handleAddVehicleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setVehicleError(null);
    setVehicleSuccessMsg(null);
    setAddingVehicle(true);
    try {
      await onAddVehicle({
        wheelerCategory: newWheelerCategory,
        vehicleType:
          newWheelerCategory === 'two_wheeler' ? 'two_wheeler' : newVehicleType,
        vehicleModel: newVehicleModel,
        plateNumber: newPlateNumber,
        isEv: newIsEv,
      });
      setVehicleSuccessMsg(
        `${newVehicleModel.trim()} (${newPlateNumber.trim().toUpperCase()}) added and selected as active.`
      );
      setNewVehicleModel('');
      setNewPlateNumber('');
      setNewIsEv(false);
    } catch (err: unknown) {
      setVehicleError(
        err instanceof Error ? err.message : 'Unable to add vehicle'
      );
    } finally {
      setAddingVehicle(false);
    }
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError(null);
    setSavingProfile(true);
    try {
      const targetVeh = activeVehicle || myVehicles[0];
      const useExistingVehicle = Boolean(targetVeh);
      await onSaveProfile({
        fullName,
        email,
        phone,
        licenseNumber,
        licenseValidTill,
        wheelerCategory: useExistingVehicle
          ? targetVeh!.wheelerCategory
          : firstWheelerCategory,
        vehicleType: useExistingVehicle
          ? targetVeh!.vehicleType
          : firstWheelerCategory === 'two_wheeler'
          ? 'two_wheeler'
          : firstVehicleType,
        vehicleModel: useExistingVehicle
          ? extractVehicleModel(targetVeh!)
          : firstVehicleModel,
        plateNumber: useExistingVehicle
          ? targetVeh!.plateNumber
          : firstPlateNumber,
        isEv: useExistingVehicle ? targetVeh!.isEv : firstIsEv,
        registeredVehicleId: targetVeh?.id,
      });
    } catch (err: unknown) {
      setProfileError(
        err instanceof Error ? err.message : 'Unable to save profile'
      );
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDeleteClick = async (vehicleId: string) => {
    setDeletingId(vehicleId);
    try {
      await onDeleteVehicle(vehicleId);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-black/[0.08] bg-white/92 p-6 shadow-sm backdrop-blur-md">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#111827]">
              Driver Profile, License &amp; Vehicles
            </h1>
            <p className="mt-1 text-sm text-[#4B5563]">
              Add your cars or two-wheelers, pick your active ride, and keep your driving license ready for gate check-in.
            </p>
          </div>
          {myVehicles.length > 0 && (
            <div className="rounded-xl border border-black/[0.08] bg-[#F8F7F4] px-3.5 py-2 text-xs font-semibold text-[#111827]">
              <span className="tabular-nums font-bold text-[#C83709]">
                {myVehicles.length}
              </span>{' '}
              {myVehicles.length === 1 ? 'vehicle' : 'vehicles'} in garage
            </div>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: My Vehicles Garage + Add Vehicle */}
        <div className="space-y-6 lg:col-span-7">
          {/* My Vehicles Garage */}
          <section className="rounded-2xl border border-black/[0.08] bg-white/92 p-6 shadow-sm backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-lg font-bold text-[#111827]">
                  My Registered Vehicles
                </h2>
                <p className="mt-0.5 text-xs text-[#4B5563]">
                  Switch your active vehicle here or directly from the Find Parking header before booking.
                </p>
              </div>
            </div>

            {/* Saved Vehicles List */}
            {myVehicles.length > 0 ? (
              <div className="mt-4 space-y-2.5">
                {myVehicles.map((v) => {
                  const isActive = v.id === activeVehicle?.id;
                  const modelName = extractVehicleModel(v);
                  return (
                    <div
                      key={v.id}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 transition-all ${
                        isActive
                          ? 'border-[#D93F0B] bg-[#FFF8F5] ring-1 ring-[#D93F0B]/50'
                          : 'border-black/[0.08] bg-[#F8F7F4]'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                            isActive
                              ? 'bg-[#FFF0EA] text-[#C83709]'
                              : 'bg-white text-[#374151] border border-black/[0.08]'
                          }`}
                        >
                          {v.wheelerCategory === 'two_wheeler' ? (
                            <Bike className="h-5 w-5" />
                          ) : (
                            <Car className="h-5 w-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-display text-sm font-bold text-[#111827]">
                              {modelName}
                            </span>
                            <span className="font-mono text-xs font-bold uppercase text-[#C83709]">
                              {v.plateNumber}
                            </span>
                            {v.isEv && (
                              <span className="inline-flex items-center gap-0.5 text-[11px] font-bold text-[#047857]">
                                <Zap className="h-3 w-3" /> EV
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[11px] text-[#4B5563]">
                            {v.wheelerCategory === 'two_wheeler'
                              ? '2-Wheeler'
                              : `4-Wheeler · ${v.vehicleType.toUpperCase()}`}{' '}
                            · {v.lengthCm}×{v.widthCm} cm
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-[#047857] px-3 py-1.5 text-xs font-bold text-white">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Active
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onSelectVehicle(v.id)}
                            className="rounded-lg border border-black/[0.12] bg-white px-3 py-1.5 text-xs font-bold text-[#111827] hover:border-[#D93F0B] hover:text-[#C83709]"
                          >
                            Use for Booking
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={deletingId === v.id}
                          onClick={() => void handleDeleteClick(v.id)}
                          aria-label={`Remove ${modelName}`}
                          className="rounded-lg border border-black/[0.08] bg-white p-1.5 text-[#4B5563] transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-xs text-amber-900">
                No personal vehicles saved yet. Use the form below to add your first car or two-wheeler.
              </div>
            )}

            {/* Add New Vehicle Form */}
            <form
              onSubmit={(e) => void handleAddVehicleSubmit(e)}
              className="mt-5 rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-4 space-y-3.5"
            >
              <div className="flex items-center gap-2 text-sm font-bold text-[#111827]">
                <Plus className="h-4 w-4 text-[#C83709]" />
                <span>Add New Vehicle</span>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleNewCategoryChange('two_wheeler')}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                    newWheelerCategory === 'two_wheeler'
                      ? 'border-[#D93F0B] bg-[#FFF0EA] text-[#C83709] ring-1 ring-[#D93F0B]'
                      : 'border-black/[0.08] bg-white text-[#374151] hover:border-black/20'
                  }`}
                >
                  <Bike className="h-4 w-4" />
                  <span>2-Wheeler</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNewCategoryChange('four_wheeler')}
                  className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                    newWheelerCategory === 'four_wheeler'
                      ? 'border-[#D93F0B] bg-[#FFF0EA] text-[#C83709] ring-1 ring-[#D93F0B]'
                      : 'border-black/[0.08] bg-white text-[#374151] hover:border-black/20'
                  }`}
                >
                  <Car className="h-4 w-4" />
                  <span>4-Wheeler</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label
                    htmlFor="add-veh-type"
                    className="mb-1 block text-xs font-semibold text-[#374151]"
                  >
                    Body Type
                  </label>
                  {newWheelerCategory === 'two_wheeler' ? (
                    <select
                      id="add-veh-type"
                      value="two_wheeler"
                      onChange={() => setNewVehicleType('two_wheeler')}
                      className="w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-xs font-medium text-[#111827] focus:border-[#D93F0B] focus:outline-none"
                    >
                      <option value="two_wheeler">Scooter / Motorcycle</option>
                    </select>
                  ) : (
                    <select
                      id="add-veh-type"
                      value={newVehicleType}
                      onChange={(e) => setNewVehicleType(e.target.value as VehicleType)}
                      className="w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-xs font-medium text-[#111827] focus:border-[#D93F0B] focus:outline-none"
                    >
                      <option value="hatchback">Hatchback</option>
                      <option value="sedan">Sedan</option>
                      <option value="suv">SUV</option>
                    </select>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="add-veh-model"
                    className="mb-1 block text-xs font-semibold text-[#374151]"
                  >
                    Vehicle Model
                  </label>
                  <input
                    id="add-veh-model"
                    type="text"
                    required
                    value={newVehicleModel}
                    onChange={(e) => setNewVehicleModel(e.target.value)}
                    placeholder={
                      newWheelerCategory === 'two_wheeler'
                        ? 'e.g., Ather 450X'
                        : 'e.g., Hyundai Creta'
                    }
                    className="w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-xs text-[#111827] focus:border-[#D93F0B] focus:outline-none"
                  />
                </div>

                <div>
                  <label
                    htmlFor="add-veh-plate"
                    className="mb-1 block text-xs font-semibold text-[#374151]"
                  >
                    Vehicle Number
                  </label>
                  <input
                    id="add-veh-plate"
                    type="text"
                    required
                    value={newPlateNumber}
                    onChange={(e) => setNewPlateNumber(e.target.value.toUpperCase())}
                    placeholder="KA-04-MN-8821"
                    className="w-full rounded-xl border border-black/[0.1] bg-white px-3 py-2 font-mono text-xs uppercase text-[#111827] focus:border-[#D93F0B] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[#111827]">
                  <input
                    type="checkbox"
                    checked={newIsEv}
                    onChange={(e) => setNewIsEv(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#047857]"
                  />
                  <span>Electric Vehicle (EV charging slot fit)</span>
                </label>

                <button
                  type="submit"
                  disabled={addingVehicle}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[#E0430D] to-[#C83709] px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:brightness-110 disabled:opacity-60"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{addingVehicle ? 'Adding Vehicle...' : 'Add Vehicle'}</span>
                </button>
              </div>

              {vehicleError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                  {vehicleError}
                </div>
              )}
              {vehicleSuccessMsg && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800">
                  {vehicleSuccessMsg}
                </div>
              )}
            </form>
          </section>
        </div>

        {/* Right Column: Driver License & Contact Details */}
        <section className="rounded-2xl border border-black/[0.08] bg-white/92 p-6 shadow-sm backdrop-blur-md lg:col-span-5 lg:self-start">
          <h2 className="font-display text-lg font-bold text-[#111827]">
            Driver License &amp; Contact Details
          </h2>

            <form onSubmit={(e) => void handleProfileSubmit(e)} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label htmlFor="drv-name" className="mb-1 block text-xs font-semibold text-[#374151]">
                    Full Name
                  </label>
                  <input
                    id="drv-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3.5 py-2 text-sm text-[#111827] focus:border-[#D93F0B] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="drv-phone" className="mb-1 block text-xs font-semibold text-[#374151]">
                    Mobile Number
                  </label>
                  <input
                    id="drv-phone"
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98450 12345"
                    className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3.5 py-2 text-sm text-[#111827] focus:border-[#D93F0B] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
                <div>
                  <label htmlFor="drv-dl" className="mb-1 block text-xs font-semibold text-[#374151]">
                    Driving License Number
                  </label>
                  <input
                    id="drv-dl"
                    type="text"
                    required
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value.toUpperCase())}
                    placeholder="KA04 20220048192"
                    className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3.5 py-2 font-mono text-sm uppercase text-[#111827] focus:border-[#D93F0B] focus:bg-white focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="drv-dl-exp" className="mb-1 block text-xs font-semibold text-[#374151]">
                    License Valid Until
                  </label>
                  <input
                    id="drv-dl-exp"
                    type="date"
                    required
                    value={licenseValidTill}
                    onChange={(e) => setLicenseValidTill(e.target.value)}
                    className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3.5 py-2 text-sm text-[#111827] focus:border-[#D93F0B] focus:bg-white focus:outline-none"
                  />
                </div>
              </div>

              {/* If user hasn't added any vehicle in the garage yet, let them register their 1st vehicle inline too */}
              {myVehicles.length === 0 && (
                <div className="space-y-3 rounded-xl border border-black/[0.06] bg-[#F8F7F4] p-3.5">
                  <div className="text-xs font-bold text-[#111827]">
                    First Vehicle Details
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => handleFirstCategoryChange('two_wheeler')}
                      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                        firstWheelerCategory === 'two_wheeler'
                          ? 'border-[#D93F0B] bg-[#FFF0EA] text-[#C83709] ring-1 ring-[#D93F0B]'
                          : 'border-black/[0.08] bg-white text-[#374151]'
                      }`}
                    >
                      <Bike className="h-4 w-4" />
                      <span>2-Wheeler</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleFirstCategoryChange('four_wheeler')}
                      className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold transition-all ${
                        firstWheelerCategory === 'four_wheeler'
                          ? 'border-[#D93F0B] bg-[#FFF0EA] text-[#C83709] ring-1 ring-[#D93F0B]'
                          : 'border-black/[0.08] bg-white text-[#374151]'
                      }`}
                    >
                      <Car className="h-4 w-4" />
                      <span>4-Wheeler</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <select
                      value={firstVehicleType}
                      onChange={(e) => setFirstVehicleType(e.target.value as VehicleType)}
                      disabled={firstWheelerCategory === 'two_wheeler'}
                      className="rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-xs text-[#111827]"
                    >
                      {firstWheelerCategory === 'two_wheeler' ? (
                        <option value="two_wheeler">Scooter / Motorcycle</option>
                      ) : (
                        <>
                          <option value="hatchback">Hatchback</option>
                          <option value="sedan">Sedan</option>
                          <option value="suv">SUV</option>
                        </>
                      )}
                    </select>
                    <input
                      type="text"
                      required
                      value={firstVehicleModel}
                      onChange={(e) => setFirstVehicleModel(e.target.value)}
                      placeholder="Vehicle Model"
                      className="rounded-xl border border-black/[0.1] bg-white px-3 py-2 text-xs text-[#111827]"
                    />
                    <input
                      type="text"
                      required
                      value={firstPlateNumber}
                      onChange={(e) => setFirstPlateNumber(e.target.value.toUpperCase())}
                      placeholder="KA-04-MN-8821"
                      className="rounded-xl border border-black/[0.1] bg-white px-3 py-2 font-mono text-xs uppercase text-[#111827]"
                    />
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-[#111827]">
                    <input
                      type="checkbox"
                      checked={firstIsEv}
                      onChange={(e) => setFirstIsEv(e.target.checked)}
                      className="h-4 w-4 rounded accent-[#047857]"
                    />
                    <span>Electric Vehicle</span>
                  </label>
                </div>
              )}

              {profileError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs text-rose-700">
                  {profileError}
                </div>
              )}

              <button
                type="submit"
                disabled={savingProfile}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#111827] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-black disabled:opacity-60"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>
                  {savingProfile ? 'Saving License Profile...' : 'Save License & Contact Info'}
                </span>
              </button>
            </form>
        </section>
      </div>
    </div>
  );
};
