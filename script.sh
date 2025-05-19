#!/bin/bash
sed -i'.bak' '1s/import React, { useState } from '\''react'\'';/import React, { useState, useEffect, useCallback } from '\''react'\'';/' src/pages/Settings.tsx
