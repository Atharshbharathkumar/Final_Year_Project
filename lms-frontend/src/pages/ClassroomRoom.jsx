import React from 'react';
import { useParams } from 'react-router-dom';
import { VirtualClassroom } from '../components/classroom/VirtualClassroom';

export const ClassroomRoom = () => {
  const { sessionId } = useParams();
  return (
    <div className="space-y-4">
      <VirtualClassroom sessionId={sessionId || 1} />
    </div>
  );
};
