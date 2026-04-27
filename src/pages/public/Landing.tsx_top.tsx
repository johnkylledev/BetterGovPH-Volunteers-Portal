import React, { useState, useEffect } from 'react';
import {
  Target,
  Server,
  Heart,
  Star,
  Building2,
  Users,
  ShieldCheck,
  IdCard,
  Globe,
  Zap,
  MessageSquare,
  ChevronRight,
  ArrowRight,
  CheckCircle2,
  HelpCircle,
  Code2,
  Network
} from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { AccessCard } from '../../components/AccessCard';
import { User } from '../../types';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useGSAP } from '@gsap/react';
import { motion } from 'framer-motion';

gsap.registerPlugin(ScrollTrigger);

const DISCORD_INVITE = "https://discord.com/invite/mHtThpN8bT";
const MAIN_WEBSITE = "https://bettergov.ph/";
const JOIN_US = "https://bettergov.ph/join-us";
