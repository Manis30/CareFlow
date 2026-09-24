import React from 'react';
import UserAvatar from './UserAvatar';

const PatientAvatar = ({
  patient,
  name: nameProp,
  src: srcProp,
  size = 'md',
  className = ''
}) => {
  return (
    <UserAvatar
      user={patient}
      name={nameProp}
      src={srcProp}
      size={size}
      role="patient"
      className={className}
    />
  );
};

export default PatientAvatar;
