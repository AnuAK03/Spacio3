import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bicycle,
  Car,
  CheckCircle,
  DotsThreeVertical,
  Gear,
  Lightning,
  Plus,
  SignOut,
  Trash,
  X,
} from '@phosphor-icons/react';
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
  onLogout: () => void;
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
  onLogout,
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

  // Profile 3-dots options menu & Settings dialog
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const settingsStorageKey = `parkpool_driver_settings_${user.email.toLowerCase()}`;
  const [defaultDurationHrs, setDefaultDurationHrs] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(settingsStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { defaultDurationHrs?: number };
        if (typeof parsed.defaultDurationHrs === 'number') return parsed.defaultDurationHrs;
      }
    } catch {
      // Ignore storage error
    }
    return 2;
  });
  const [preferEvBays, setPreferEvBays] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(settingsStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { preferEvBays?: boolean };
        if (typeof parsed.preferEvBays === 'boolean') return parsed.preferEvBays;
      }
    } catch {
      // Ignore storage error
    }
    return false;
  });
  const [reminderAlerts, setReminderAlerts] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(settingsStorageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { reminderAlerts?: boolean };
        if (typeof parsed.reminderAlerts === 'boolean') return parsed.reminderAlerts;
      }
    } catch {
      // Ignore storage error
    }
    return true;
  });
  const [settingsSavedNote, setSettingsSavedNote] = useState<string | null>(null);

  useEffect(() => {
    if (!menuOpen && !settingsOpen) return;
    const handleOutside = (ev: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(ev.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setMenuOpen(false);
        setSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen, settingsOpen]);

  const handleSaveDriverSettings = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      localStorage.setItem(
        settingsStorageKey,
        JSON.stringify({
          defaultDurationHrs,
          preferEvBays,
          reminderAlerts,
        })
      );
      setSettingsSavedNote('Preferences saved for this device.');
    } catch {
      setSettingsSavedNote('Preferences updated for this session.');
    }
  };

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
      <section className="rounded-2xl border border-black/[0.08] bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="heading-5 text-[#111827]">
              Driver profile, license, and vehicles
            </h1>
            <p className="mt-1 body-6 text-[#4B5563]">
              Add your cars or scooters, pick your active ride, and keep your driving license ready for gate entry.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {myVehicles.length > 0 && (
              <div className="rounded-xl border border-black/[0.08] bg-[#F8F7F4] px-3 py-2 caption-3 text-[#111827]">
                <span className="tabular-nums font-semibold text-[#C83709]">
                  {myVehicles.length}
                </span>{' '}
                {myVehicles.length === 1 ? 'vehicle' : 'vehicles'} in garage
              </div>
            )}

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                aria-label="Profile options"
                aria-haspopup="menu"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((prev) => !prev)}
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/[0.08] bg-[#F8F7F4] text-[#111827] transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[#C83709] hover:bg-white active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C83709]"
              >
                <DotsThreeVertical className="h-5 w-5" weight="bold" />
              </button>

              {menuOpen && (
                <div
                  role="menu"
                  aria-label="Profile actions"
                  className="absolute right-0 top-12 z-30 w-48 rounded-xl border border-black/[0.08] bg-white p-2 shadow-lg"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setSettingsSavedNote(null);
                      setSettingsOpen(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left button-xsm text-[#111827] transition-colors duration-200 hover:bg-[#F8F7F4]"
                  >
                    <Gear className="h-4 w-4 text-[#4B5563]" weight="bold" />
                    <span>Settings</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      onLogout();
                    }}
                    className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left button-xsm text-rose-700 transition-colors duration-200 hover:bg-rose-50"
                  >
                    <SignOut className="h-4 w-4 text-rose-600" weight="bold" />
                    <span>Log out</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: My Vehicles Garage + Add Vehicle */}
        <div className="space-y-6 lg:col-span-7">
          {/* My Vehicles Garage */}
          <section className="rounded-2xl border border-black/[0.08] bg-white p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="heading-6 text-[#111827]">My registered vehicles</h2>
                <p className="mt-0.5 caption-2 text-[#4B5563]">
                  Switch your active vehicle here or directly from Find Parking before reserving.
                </p>
              </div>
            </div>

            {myVehicles.length > 0 ? (
              <div className="mt-4 space-y-3">
                {myVehicles.map((v) => {
                  const isActive = v.id === activeVehicle?.id;
                  const modelName = extractVehicleModel(v);
                  return (
                    <div
                      key={v.id}
                      className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                        isActive
                          ? 'border-[#C83709] bg-[#FFF8F5] ring-1 ring-[#C83709]/40'
                          : 'border-black/[0.08] bg-[#F8F7F4]'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
                            isActive
                              ? 'bg-[#FFF0EA] text-[#C83709]'
                              : 'bg-white text-[#374151] border border-black/[0.08]'
                          }`}
                        >
                          {v.wheelerCategory === 'two_wheeler' ? (
                            <Bicycle className="h-5 w-5" weight="duotone" />
                          ) : (
                            <Car className="h-5 w-5" weight="duotone" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate title-4 text-[#111827]">{modelName}</span>
                            <span className="font-mono caption-3 uppercase text-[#C83709]">
                              {v.plateNumber}
                            </span>
                            {v.isEv && (
                              <span className="inline-flex items-center gap-1 caption-3 text-[#047857]">
                                <Lightning className="h-3 w-3" weight="fill" /> EV
                              </span>
                            )}
                          </div>
                          <div className="mt-0.5 caption-5 text-[#4B5563]">
                            {v.wheelerCategory === 'two_wheeler'
                              ? '2 Wheeler'
                              : `4 Wheeler · ${v.vehicleType.toUpperCase()}`}{' '}
                            · {v.lengthCm}×{v.widthCm} cm
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1 rounded-lg bg-[#047857] px-3 py-2 button-xsm text-white">
                            <CheckCircle className="h-3.5 w-3.5" weight="fill" />
                            Active
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => onSelectVehicle(v.id)}
                            className="rounded-lg border border-black/[0.12] bg-white px-3 py-2 button-xsm text-[#111827] transition-colors duration-300 hover:border-[#C83709] hover:text-[#C83709]"
                          >
                            Use for booking
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={deletingId === v.id}
                          onClick={() => void handleDeleteClick(v.id)}
                          aria-label={`Remove ${modelName}`}
                          className="rounded-lg border border-black/[0.08] bg-white p-2 text-[#4B5563] transition-colors duration-300 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 caption-2 text-amber-900">
                No personal vehicles saved yet. Use the form below to add your first vehicle.
              </div>
            )}

            <form
              onSubmit={(e) => void handleAddVehicleSubmit(e)}
              className="mt-6 rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-4 space-y-4"
            >
              <div className="flex items-center gap-2 title-4 text-[#111827]">
                <Plus className="h-4 w-4 text-[#C83709]" weight="bold" />
                <span>Add new vehicle</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleNewCategoryChange('two_wheeler')}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 button-xsm transition-all duration-300 ${
                    newWheelerCategory === 'two_wheeler'
                      ? 'border-[#C83709] bg-[#FFF0EA] text-[#C83709] ring-1 ring-[#C83709]'
                      : 'border-black/[0.08] bg-white text-[#374151] hover:border-black/20'
                  }`}
                >
                  <Bicycle className="h-4 w-4" />
                  <span>2 Wheeler</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleNewCategoryChange('four_wheeler')}
                  className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 button-xsm transition-all duration-300 ${
                    newWheelerCategory === 'four_wheeler'
                      ? 'border-[#C83709] bg-[#FFF0EA] text-[#C83709] ring-1 ring-[#C83709]'
                      : 'border-black/[0.08] bg-white text-[#374151] hover:border-black/20'
                  }`}
                >
                  <Car className="h-4 w-4" />
                  <span>4 Wheeler</span>
                </button>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label htmlFor="add-veh-type" className="mb-1 block title-5 text-[#374151]">
                    Body type
                  </label>
                  {newWheelerCategory === 'two_wheeler' ? (
                    <select
                      id="add-veh-type"
                      value="two_wheeler"
                      onChange={() => setNewVehicleType('two_wheeler')}
                      className="w-full rounded-lg border border-black/[0.1] bg-white px-3 py-2 caption-4 text-[#111827] focus:border-[#C83709] focus:outline-none"
                    >
                      <option value="two_wheeler">Scooter / Motorcycle</option>
                    </select>
                  ) : (
                    <select
                      id="add-veh-type"
                      value={newVehicleType}
                      onChange={(e) => setNewVehicleType(e.target.value as VehicleType)}
                      className="w-full rounded-lg border border-black/[0.1] bg-white px-3 py-2 caption-4 text-[#111827] focus:border-[#C83709] focus:outline-none"
                    >
                      <option value="hatchback">Hatchback</option>
                      <option value="sedan">Sedan</option>
                      <option value="suv">SUV</option>
                    </select>
                  )}
                </div>

                <div>
                  <label htmlFor="add-veh-model" className="mb-1 block title-5 text-[#374151]">
                    Vehicle model
                  </label>
                  <input
                    id="add-veh-model"
                    type="text"
                    required
                    value={newVehicleModel}
                    onChange={(e) => setNewVehicleModel(e.target.value)}
                    placeholder={
                      newWheelerCategory === 'two_wheeler'
                        ? 'e.g. Ather 450X'
                        : 'e.g. Hyundai Creta'
                    }
                    className="w-full rounded-lg border border-black/[0.1] bg-white px-3 py-2 caption-2 text-[#111827] focus:border-[#C83709] focus:outline-none"
                  />
                </div>

                <div>
                  <label htmlFor="add-veh-plate" className="mb-1 block title-5 text-[#374151]">
                    Vehicle number
                  </label>
                  <input
                    id="add-veh-plate"
                    type="text"
                    required
                    value={newPlateNumber}
                    onChange={(e) => setNewPlateNumber(e.target.value.toUpperCase())}
                    placeholder="KA04MN8821"
                    className="w-full rounded-lg border border-black/[0.1] bg-white px-3 py-2 font-mono caption-4 uppercase text-[#111827] focus:border-[#C83709] focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <label className="flex cursor-pointer items-center gap-2 caption-4 text-[#111827]">
                  <input
                    type="checkbox"
                    checked={newIsEv}
                    onChange={(e) => setNewIsEv(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#047857]"
                  />
                  <span>Electric vehicle (EV charger fit)</span>
                </label>

                <button
                  type="submit"
                  disabled={addingVehicle}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#C83709] px-3 py-2 button-xsm text-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-[#B23008] active:scale-[0.98] disabled:opacity-60"
                >
                  <Plus className="h-3.5 w-3.5" weight="bold" />
                  <span>{addingVehicle ? 'Adding vehicle...' : 'Add vehicle'}</span>
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
        <section className="rounded-2xl border border-black/[0.08] bg-white p-6 lg:col-span-5 lg:self-start">
          <h2 className="heading-6 text-[#111827]">Driver license and contact details</h2>

          <form onSubmit={(e) => void handleProfileSubmit(e)} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="drv-name" className="mb-1 block title-5 text-[#374151]">
                  Full name
                </label>
                <input
                  id="drv-name"
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 body-5 text-[#111827] focus:border-[#C83709] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="drv-phone" className="mb-1 block title-5 text-[#374151]">
                  Mobile number
                </label>
                <input
                  id="drv-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98450 12345"
                  className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 body-5 text-[#111827] focus:border-[#C83709] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="drv-dl" className="mb-1 block title-5 text-[#374151]">
                  Driving license number
                </label>
                <input
                  id="drv-dl"
                  type="text"
                  required
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value.toUpperCase())}
                  placeholder="KA04 20220048192"
                  className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 font-mono body-5 uppercase text-[#111827] focus:border-[#C83709] focus:bg-white focus:outline-none"
                />
              </div>

              <div>
                <label htmlFor="drv-dl-exp" className="mb-1 block title-5 text-[#374151]">
                  License valid until
                </label>
                <input
                  id="drv-dl-exp"
                  type="date"
                  required
                  value={licenseValidTill}
                  onChange={(e) => setLicenseValidTill(e.target.value)}
                  className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 body-5 text-[#111827] focus:border-[#C83709] focus:bg-white focus:outline-none"
                />
              </div>
            </div>

            {myVehicles.length === 0 && (
              <div className="space-y-3 rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-4">
                <div className="title-5 text-[#111827]">First vehicle details</div>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleFirstCategoryChange('two_wheeler')}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 button-xsm transition-all duration-300 ${
                      firstWheelerCategory === 'two_wheeler'
                        ? 'border-[#C83709] bg-[#FFF0EA] text-[#C83709] ring-1 ring-[#C83709]'
                        : 'border-black/[0.08] bg-white text-[#374151]'
                    }`}
                  >
                    <Bicycle className="h-4 w-4" />
                    <span>2 Wheeler</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFirstCategoryChange('four_wheeler')}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 button-xsm transition-all duration-300 ${
                      firstWheelerCategory === 'four_wheeler'
                        ? 'border-[#C83709] bg-[#FFF0EA] text-[#C83709] ring-1 ring-[#C83709]'
                        : 'border-black/[0.08] bg-white text-[#374151]'
                    }`}
                  >
                    <Car className="h-4 w-4" />
                    <span>4 Wheeler</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <select
                    value={firstVehicleType}
                    onChange={(e) => setFirstVehicleType(e.target.value as VehicleType)}
                    disabled={firstWheelerCategory === 'two_wheeler'}
                    className="rounded-lg border border-black/[0.1] bg-white px-3 py-2 caption-4 text-[#111827]"
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
                    placeholder="Vehicle model"
                    className="rounded-lg border border-black/[0.1] bg-white px-3 py-2 caption-2 text-[#111827]"
                  />
                  <input
                    type="text"
                    required
                    value={firstPlateNumber}
                    onChange={(e) => setFirstPlateNumber(e.target.value.toUpperCase())}
                    placeholder="KA04MN8821"
                    className="rounded-lg border border-black/[0.1] bg-white px-3 py-2 font-mono caption-4 uppercase text-[#111827]"
                  />
                </div>
                <label className="flex cursor-pointer items-center gap-2 caption-4 text-[#111827]">
                  <input
                    type="checkbox"
                    checked={firstIsEv}
                    onChange={(e) => setFirstIsEv(e.target.checked)}
                    className="h-4 w-4 rounded accent-[#047857]"
                  />
                  <span>Electric vehicle</span>
                </label>
              </div>
            )}

            {profileError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 caption-2 text-rose-700">
                {profileError}
              </div>
            )}

            <button
              type="submit"
              disabled={savingProfile}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#111827] px-3 py-2 button-md text-white transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:bg-black active:scale-[0.98] disabled:opacity-60"
            >
              <CheckCircle className="h-4 w-4" weight="fill" />
              <span>
                {savingProfile ? 'Saving license profile...' : 'Save license and contact info'}
              </span>
            </button>
          </form>
        </section>
      </div>

      {settingsOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Driver settings"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-md rounded-2xl border border-black/[0.08] bg-white p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="heading-6 text-[#111827]">Account settings</h2>
                <p className="mt-1 caption-2 text-[#4B5563]">
                  Manage your booking preferences and alerts.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close settings"
                onClick={() => setSettingsOpen(false)}
                className="rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-2 text-[#4B5563] hover:text-[#111827]"
              >
                <X className="h-4 w-4" weight="bold" />
              </button>
            </div>

            <div className="rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-4 space-y-1">
              <div className="title-4 text-[#111827]">{user.name}</div>
              <div className="caption-2 text-[#4B5563]">{user.email}</div>
              <div className="caption-5 text-[#6B7280]">{user.organization}</div>
            </div>

            <form onSubmit={handleSaveDriverSettings} className="space-y-4">
              <div>
                <label
                  htmlFor="driver-pref-duration"
                  className="mb-1 block title-5 text-[#374151]"
                >
                  Preferred booking duration
                </label>
                <select
                  id="driver-pref-duration"
                  value={defaultDurationHrs}
                  onChange={(e) => setDefaultDurationHrs(Number(e.target.value))}
                  className="w-full rounded-xl border border-black/[0.1] bg-[#F8F7F4] px-3 py-2 body-5 text-[#111827]"
                >
                  <option value={1}>1 hour</option>
                  <option value={2}>2 hours</option>
                  <option value={3}>3 hours</option>
                  <option value={4}>4 hours</option>
                </select>
              </div>

              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-3">
                <div>
                  <div className="title-5 text-[#111827]">Prioritize EV charging bays</div>
                  <div className="caption-5 text-[#4B5563]">
                    Highlight spaces with electric vehicle chargers first.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={preferEvBays}
                  onChange={(e) => setPreferEvBays(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#047857]"
                />
              </label>

              <label className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-black/[0.08] bg-[#F8F7F4] p-3">
                <div>
                  <div className="title-5 text-[#111827]">Booking and exit reminders</div>
                  <div className="caption-5 text-[#4B5563]">
                    Show arrival window and checkout alerts before time ends.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={reminderAlerts}
                  onChange={(e) => setReminderAlerts(e.target.checked)}
                  className="h-4 w-4 rounded accent-[#C83709]"
                />
              </label>

              {settingsSavedNote && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 caption-4 text-emerald-900">
                  {settingsSavedNote}
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setSettingsOpen(false);
                    onLogout();
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 button-xsm text-rose-700 hover:bg-rose-100"
                >
                  <SignOut className="h-4 w-4" weight="bold" />
                  <span>Log out</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSettingsOpen(false)}
                    className="rounded-xl border border-black/[0.1] bg-white px-3 py-2 button-xsm text-[#374151]"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-[#111827] px-3 py-2 button-xsm text-white hover:bg-black"
                  >
                    Save settings
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
