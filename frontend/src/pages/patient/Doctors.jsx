import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  RotateCcw,
  Users
} from 'lucide-react';
import { getDoctorsApi } from '../../api/doctor';
import { getOrganizationCitiesApi, getActiveOrganizationsApi } from '../../api/organization';
import { getDepartmentsApi } from '../../api/department';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Button from '../../components/common/Button';
import Pagination from '../../components/common/Pagination';
import usePagination from '../../hooks/usePagination';
import ContentContainer from '../../components/layout/ContentContainer';
import PageHeader from '../../components/layout/PageHeader';
import DoctorCard from '../../components/clinical/DoctorCard';
import { CardSkeleton } from '../../components/common/Skeleton';

export const PatientDoctors = () => {
  const [searchParams] = useSearchParams();
  const initialSearch = searchParams.get('search') || '';
  const initialSpecialty = searchParams.get('specialty') || searchParams.get('department') || '';

  const [cities, setCities] = useState([]);
  const [selectedCity, setSelectedCity] = useState(searchParams.get('city') || '');
  const [clinics, setClinics] = useState([]);
  const [selectedClinicId, setSelectedClinicId] = useState(
    searchParams.get('organizationId') || ''
  );

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedDepartment, setSelectedDepartment] = useState(initialSpecialty || 'all');
  const [allDepartments, setAllDepartments] = useState([]);
  const [clinicDepartments, setClinicDepartments] = useState([]);
  const [selectedMode, setSelectedMode] = useState('all'); // 'all' | 'online' | 'offline'

  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const navigate = useNavigate();

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError('');

      const [citiesRes, doctorsRes, clinicsRes, deptsRes] = await Promise.all([
        getOrganizationCitiesApi().catch(() => ({ data: [] })),
        getDoctorsApi().catch(() => ({ data: [] })),
        getActiveOrganizationsApi({ city: selectedCity || undefined }).catch(() => ({ data: [] })),
        getDepartmentsApi().catch(() => ({ data: [] }))
      ]);

      const cityList = citiesRes.data || (Array.isArray(citiesRes) ? citiesRes : []);
      setCities(Array.isArray(cityList) ? cityList : []);

      const docList =
        doctorsRes.data?.doctors ||
        doctorsRes.data ||
        (Array.isArray(doctorsRes) ? doctorsRes : []);
      setDoctors(Array.isArray(docList) ? docList : []);

      const clinicList = clinicsRes.data || (Array.isArray(clinicsRes) ? clinicsRes : []);
      setClinics(Array.isArray(clinicList) ? clinicList : []);

      const deptList = deptsRes.data || (Array.isArray(deptsRes) ? deptsRes : []);
      setAllDepartments(Array.isArray(deptList) ? deptList : []);
    } catch (err) {
      setError(err.message || 'Failed to load doctors catalog');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedCity) {
      fetchClinics(selectedCity);
    } else {
      fetchAllClinics();
    }
  }, [selectedCity]);

  useEffect(() => {
    if (selectedClinicId) {
      fetchClinicDepartments(selectedClinicId);
    } else {
      setClinicDepartments([]);
    }
  }, [selectedClinicId]);

  const fetchClinics = async (city) => {
    try {
      const res = await getActiveOrganizationsApi({ city });
      const clinicList = res.data || (Array.isArray(res) ? res : []);
      setClinics(Array.isArray(clinicList) ? clinicList : []);
    } catch {
      setClinics([]);
    }
  };

  const fetchAllClinics = async () => {
    try {
      const res = await getActiveOrganizationsApi();
      const clinicList = res.data || (Array.isArray(res) ? res : []);
      setClinics(Array.isArray(clinicList) ? clinicList : []);
    } catch {
      setClinics([]);
    }
  };

  const fetchClinicDepartments = async (clinicId) => {
    try {
      const res = await getDepartmentsApi({ organizationId: clinicId });
      const list = res.data || (Array.isArray(res) ? res : []);
      setClinicDepartments(Array.isArray(list) ? list : []);
    } catch {
      setClinicDepartments([]);
    }
  };

  const handleCityChange = (e) => {
    const city = e.target.value;
    setSelectedCity(city);
    setSelectedClinicId('');
    setSelectedDepartment('all');
  };

  const handleClinicChange = (e) => {
    const clinicId = e.target.value;
    setSelectedClinicId(clinicId);
    setSelectedDepartment('all');
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedCity('');
    setSelectedClinicId('');
    setSelectedDepartment('all');
    setSelectedMode('all');
  };

  // Compute available departments: specific to clinic if selected, or aggregated across all clinics
  const availableDepartments = useMemo(() => {
    const map = new Map();

    if (selectedClinicId && clinicDepartments.length > 0) {
      clinicDepartments.forEach((d) => {
        const name = d?.name?.trim();
        if (name && !map.has(name.toLowerCase())) {
          map.set(name.toLowerCase(), { id: name, name });
        }
      });
      return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }

    allDepartments.forEach((d) => {
      const name = d?.name?.trim();
      if (name && !map.has(name.toLowerCase())) {
        map.set(name.toLowerCase(), { id: name, name });
      }
    });

    doctors.forEach((doc) => {
      const spec = (doc.specialization || doc.specialty || '').trim();
      if (spec && !map.has(spec.toLowerCase())) {
        map.set(spec.toLowerCase(), { id: spec, name: spec });
      }
      const deptName = (doc.departmentId?.name || '').trim();
      if (deptName && !map.has(deptName.toLowerCase())) {
        map.set(deptName.toLowerCase(), { id: deptName, name: deptName });
      }
      if (Array.isArray(doc.departments)) {
        doc.departments.forEach((d) => {
          const s = String(d).trim();
          if (s && !map.has(s.toLowerCase())) {
            map.set(s.toLowerCase(), { id: s, name: s });
          }
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedClinicId, clinicDepartments, allDepartments, doctors]);

  // Clean Multi-criteria Filtered Doctors
  const filteredDoctors = useMemo(() => {
    return doctors.filter((doc) => {
      // 1. Text Search across name, specialty, clinic, department, and city
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const docName = (doc.userId?.name || doc.name || '').toLowerCase();
        const spec = (doc.specialization || doc.specialty || '').toLowerCase();
        const clinicName = (doc.organizationId?.name || doc.clinicName || '').toLowerCase();
        const deptName = (doc.departmentId?.name || '').toLowerCase();
        const deptsArr = (doc.departments || []).map((d) => String(d).toLowerCase()).join(' ');
        const docCity = (
          doc.organizationId?.address?.city ||
          doc.organizationId?.city ||
          doc.organizationId?.address?.district ||
          ''
        ).toLowerCase();

        const matchesSearch =
          docName.includes(q) ||
          spec.includes(q) ||
          clinicName.includes(q) ||
          deptName.includes(q) ||
          deptsArr.includes(q) ||
          docCity.includes(q);

        if (!matchesSearch) return false;
      }

      // 2. City Filter: match against organization address.city / city / district
      if (selectedCity) {
        const docCity = (
          doc.organizationId?.address?.city ||
          doc.organizationId?.city ||
          doc.organizationId?.address?.district ||
          ''
        ).toLowerCase().trim();
        if (docCity !== selectedCity.toLowerCase().trim()) return false;
      }

      // 3. Hospital / Facility Filter
      if (selectedClinicId) {
        const orgId = (
          doc.organizationId?._id ||
          doc.organizationId ||
          ''
        ).toString();
        if (orgId !== String(selectedClinicId)) return false;
      }

      // 4. Department Filter: match against ID or department/specialty name
      if (selectedDepartment && selectedDepartment !== 'all') {
        const target = String(selectedDepartment).toLowerCase().trim();
        const depId = (doc.departmentId?._id || doc.departmentId || '').toString().toLowerCase();
        const depName = (doc.departmentId?.name || '').toLowerCase().trim();
        const specName = (doc.specialization || doc.specialty || '').toLowerCase().trim();
        const depIds = Array.isArray(doc.departmentIds)
          ? doc.departmentIds.map((d) => (d?._id || d?.name || d || '').toString().toLowerCase())
          : [];
        const deptsArr = Array.isArray(doc.departments)
          ? doc.departments.map((d) => String(d).toLowerCase().trim())
          : [];

        const matchesDept =
          depName === target ||
          specName === target ||
          deptsArr.includes(target) ||
          depId === target ||
          depIds.includes(target) ||
          (depName && depName.includes(target)) ||
          (specName && specName.includes(target)) ||
          deptsArr.some((d) => d && (d.includes(target) || target.includes(d)));

        if (!matchesDept) return false;
      }

      // 5. Consultation Mode Filter
      if (selectedMode !== 'all') {
        const modes = Array.isArray(doc.consultationModes) && doc.consultationModes.length > 0
          ? doc.consultationModes
          : ['online', 'offline'];
        if (!modes.includes(selectedMode)) return false;
      }

      return true;
    });
  }, [doctors, searchQuery, selectedCity, selectedClinicId, selectedDepartment, selectedMode]);

  const {
    paginatedItems: paginatedDoctors = [],
    page: currentPage = 1,
    totalPages = 1,
    setPage: goToPage = () => {},
    totalItems: totalResults = 0
  } = usePagination(filteredDoctors, 9);

  // Reset pagination to page 1 whenever any filter criteria changes
  useEffect(() => {
    goToPage(1);
  }, [searchQuery, selectedCity, selectedClinicId, selectedDepartment, selectedMode]);

  if (loading) {
    return (
      <ContentContainer className="space-y-6 pb-12">
        <div className="h-16 bg-white rounded-xl border border-slate-200/80 p-4 animate-pulse" />
        <div className="h-28 bg-white rounded-xl border border-slate-200/80 p-4 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </ContentContainer>
    );
  }

  if (error) {
    return (
      <ContentContainer className="py-12">
        <ErrorState message={error} onRetry={fetchInitialData} />
      </ContentContainer>
    );
  }

  const hasActiveFilters = Boolean(
    searchQuery ||
      selectedCity ||
      selectedClinicId ||
      selectedDepartment !== 'all' ||
      selectedMode !== 'all'
  );

  return (
    <ContentContainer className="space-y-6 pb-12">
      {/* 1. Header */}
      <PageHeader
        subtitle="Search board-certified physicians, clinical departments, and appointment availability across our accredited medical network."
        actions={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 shadow-2xs">
              <Users className="w-4 h-4 text-blue-600" />
              {filteredDoctors.length} {filteredDoctors.length === 1 ? 'Clinician' : 'Clinicians'} Available
            </span>
          </div>
        }
      />

      {/* 2. Structured Search & Multi-criteria Filter Workspace */}
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-4">
        {/* Main Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by doctor name, medical specialty, or facility..."
            className="w-full text-xs sm:text-sm font-medium text-slate-900 bg-slate-50 rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all placeholder:text-slate-400"
          />
        </div>

        {/* Filters Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* City Filter */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 text-[11px] uppercase tracking-wider">
              Location / City
            </label>
            <select
              value={selectedCity}
              onChange={handleCityChange}
              className="w-full text-xs font-medium text-slate-800 bg-white rounded-xl border border-slate-200 py-2 px-3 focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="">All Locations</option>
              {cities.map((c, idx) => (
                <option key={idx} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Clinic Filter */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 text-[11px] uppercase tracking-wider">
              Hospital / Facility
            </label>
            <select
              value={selectedClinicId}
              onChange={handleClinicChange}
              className="w-full text-xs font-medium text-slate-800 bg-white rounded-xl border border-slate-200 py-2 px-3 focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="">All Facilities</option>
              {clinics.map((clinic) => (
                <option key={clinic._id} value={clinic._id}>
                  {clinic.name}
                </option>
              ))}
            </select>
          </div>

          {/* Department Filter */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 text-[11px] uppercase tracking-wider">
              Department
            </label>
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="w-full text-xs font-medium text-slate-800 bg-white rounded-xl border border-slate-200 py-2 px-3 focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="all">
                {selectedClinicId ? 'All Facility Departments' : 'All Departments'}
              </option>
              {availableDepartments.map((dep) => (
                <option key={dep.id} value={dep.id}>
                  {dep.name}
                </option>
              ))}
            </select>
          </div>

          {/* Consultation Mode */}
          <div>
            <label className="block font-semibold text-slate-700 mb-1 text-[11px] uppercase tracking-wider">
              Consultation Mode
            </label>
            <select
              value={selectedMode}
              onChange={(e) => setSelectedMode(e.target.value)}
              className="w-full text-xs font-medium text-slate-800 bg-white rounded-xl border border-slate-200 py-2 px-3 focus:outline-hidden focus:border-blue-500 cursor-pointer"
            >
              <option value="all">All Modes</option>
              <option value="online">Online Consultation</option>
              <option value="offline">In-Clinic Visit</option>
            </select>
          </div>
        </div>

        {/* Reset Filters */}
        {hasActiveFilters && (
          <div className="flex justify-end pt-1 border-t border-slate-100">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              icon={RotateCcw}
              className="text-xs text-slate-500 hover:text-slate-900"
            >
              Reset Filters
            </Button>
          </div>
        )}
      </div>

      {/* 3. Doctors Catalog Grid */}
      {filteredDoctors.length > 0 ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedDoctors.map((doctor) => (
              <DoctorCard
                key={doctor._id}
                doctor={doctor}
                onViewDetails={() => navigate(`/patient/doctors/${doctor._id}`)}
                onBook={() => navigate(`/patient/book-appointment?doctorId=${doctor._id}`)}
              />
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pt-2">
              <Pagination
                page={currentPage}
                totalPages={totalPages}
                onPageChange={goToPage}
                totalItems={totalResults}
              />
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="No clinicians match your search criteria"
          description="Try broadening your search term, switching city filters, or removing the department filter."
          actionText="Reset Filters"
          onAction={handleResetFilters}
        />
      )}
    </ContentContainer>
  );
};

export default PatientDoctors;
