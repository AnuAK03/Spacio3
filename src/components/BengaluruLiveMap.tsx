import React from 'react';
import { CandidateEvaluation, Facility } from '../types/parkpool';
import { GoogleParkingMap, GoogleParkingMapProps } from './GoogleParkingMap';

interface BengaluruLiveMapProps extends Omit<GoogleParkingMapProps, 'facilities' | 'evaluations'> {
  facilities: Facility[];
  evaluations?: CandidateEvaluation[];
}

export const BengaluruLiveMap: React.FC<BengaluruLiveMapProps> = (props) => {
  return <GoogleParkingMap {...props} />;
};
